import NextAuth, { type AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { isAdmin, validateCredentials } from "@/lib/auth"
import { checkRateLimit } from '@/lib/rateLimiter'
import { prisma } from "@/lib/prisma"
import speakeasy from 'speakeasy'
import bcrypt from 'bcrypt'
import { encode as encodeJwt, decode as decodeJwt } from "next-auth/jwt"
import jwt from "jsonwebtoken"
import { notifyUserOrEmployee } from "@/lib/notifications"

async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) return false;
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secretKey}&response=${token}`
    });
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "MFA Code", type: "text", optional: true }, // New field for MFA
        recaptchaToken: { label: "reCAPTCHA Token", type: "text", optional: true },
      },
      async authorize(credentials, req) {
        // Rate limiting: 5 login attempts per minute per IP
        const ip = req?.headers?.["x-forwarded-for"]?.toString() || "unknown";
        if (!checkRateLimit(ip, { windowMs: 60_000, max: 5 })) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // Verify reCAPTCHA
        if (!credentials.recaptchaToken) {
          throw new Error("reCAPTCHA is required");
        }
        const isRecaptchaValid = await verifyRecaptcha(credentials.recaptchaToken);
        if (!isRecaptchaValid) {
          throw new Error("Invalid reCAPTCHA");
        }

        // Normalize email to lowercase for login
        const normalizedEmail = credentials.email.toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            email: true,
            password: true,
            role: true,
            mfaEnabled: true,
            mfaSecret: true,
            isApproved: true,
            name: true,
          },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password ?? "");

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        // Enforce MFA for admin users
        if (user.role === 'admin' && user.mfaEnabled) {
          if (!credentials.mfaCode) {
            throw new Error("MFA code is required for admin login");
          }
          if (!user.mfaSecret) {
            throw new Error("MFA secret is not set for this user");
          }
          const isValidMfa = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: "base32",
            token: credentials.mfaCode,
          });
          if (!isValidMfa) {
            throw new Error("Invalid MFA code");
          }
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          isAdmin: user.role === 'admin',
          mfaEnabled: Boolean((user as any).mfaEnabled),
          isApproved: Boolean((user as any).isApproved),
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Update session every hour
  },
  jwt: {
    async encode({ token, secret }) {
      if (!token || !secret) return "";
      return jwt.sign(token, secret, { algorithm: "HS256" });
    },
    async decode({ token, secret }) {
      if (!token || !secret) return null;
      try {
        const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
        if (typeof decoded === "string") {
          return { token: decoded };
        }
        return decoded;
      } catch {
        return null;
      }
    },
  },
  // Allow JS access to the session token for WebSocket auth (see NextAuth docs)
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: false, // Needed for browser JS access (WebSocket auth)
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
        token.mfaEnabled = Boolean((user as any).mfaEnabled);
        token.isApproved = Boolean((user as any).isApproved);
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
        (session.user as any).mfaEnabled = !!(token as any).mfaEnabled;
        (session.user as any).isApproved = !!(token as any).isApproved;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    async signIn({ user }) {
      // Notify user of successful login
      if (user?.id) {
        try {
          await notifyUserOrEmployee({
            userId: String(user.id),
            type: "login_success",
            message: `Login successful. Welcome back, ${user.name || user.email}!`,
            actionUrl: "/profile",
            actionLabel: "View Profile",
          });
        } catch (notifyErr) {
          console.error("[Notification] Failed to notify admin of login:", notifyErr);
        }
      }
    },
    // You can add signOut, error, etc. here as well
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
