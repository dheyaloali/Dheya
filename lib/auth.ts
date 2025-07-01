import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { isPasswordComplex, passwordComplexityMessage } from './passwordUtils'
import crypto from 'crypto'
import speakeasy from 'speakeasy'

const prisma = new PrismaClient();

// User roles constant
export const ROLES = {
  ADMIN: "admin",
  EMPLOYEE: "employee",
}

// Function to check if a user is an admin
export async function isAdmin(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  })
  return user?.role === ROLES.ADMIN
}

// Function to validate credentials against database
export async function validateCredentials(email: string, password: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) return false

    // Compare password with hashed password in database
    return await bcrypt.compare(password, user.password)
  } catch (error) {
    console.error('Error validating credentials:', error)
    return false
  }
}

// Generate a password reset token
export async function generateResetToken(email: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) return null

  // Generate a random token
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    // Store token in database with expiration
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        resetToken: token,
        resetTokenExpires: new Date(Date.now() + 3600000) // 1 hour from now
      }
  })

  return token
  } catch (error) {
    console.error('Error generating reset token:', error)
    return null
  }
}

// Verify a reset token
export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date()
        }
      }
    })

    return user?.email || null
  } catch (error) {
    console.error('Error verifying reset token:', error)
    return null
  }
}

// Reset a password
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    // Enforce password complexity
    if (!isPasswordComplex(newPassword)) {
      console.error('Password reset failed: ' + passwordComplexityMessage())
    return false
  }
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date()
        }
      }
    })

    if (!user) return false

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null
      }
    })

    return true
  } catch (error) {
    console.error('Error resetting password:', error)
    return false
  }
}

export async function requestPasswordReset(email: string, recaptchaToken: string) {
  try {
    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, recaptchaToken }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Password reset request error:', error);
    return {
      success: false,
      message: 'Failed to send reset link. Please try again.',
    };
  }
}

// Generate an email verification token
export async function generateVerificationToken(email: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) return null;

    // Generate a random token
    const token = crypto.randomBytes(32).toString("hex");

    // Store token in database with expiration (24 hours)
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        verificationToken: token,
        verificationTokenExpires: new Date(Date.now() + 24 * 3600000) // 24 hours from now
      }
    });

    return token;
  } catch (error) {
    console.error('Error generating verification token:', error);
    return null;
  }
}

// Verify an email verification token
export async function verifyEmailToken(token: string): Promise<boolean> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) return false;

    // Mark email as verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpires: null
      }
    });

    return true;
  } catch (error) {
    console.error('Error verifying email token:', error);
    return false;
  }
}

// Check if email is verified
export async function isEmailVerified(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    return !!user?.emailVerified;
  } catch (error) {
    console.error('Error checking email verification:', error);
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "MFA Code", type: "text" },
        recaptchaToken: { label: "reCAPTCHA Token", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Check if email is verified for non-admin users
        if (user.role !== 'admin' && !user.emailVerified) {
          throw new Error("EmailNotVerified");
        }

        // Check if user is admin and has MFA enabled
        if (user.role === 'admin') {
          // If MFA is not set up yet, redirect to setup
          if (!user.mfaSecret) {
            throw new Error("MFA code is required for admin login");
          }
          
          // If MFA is enabled, verify the code
          if (user.mfaEnabled) {
            // If no MFA code provided, request it
            if (!credentials.mfaCode) {
              throw new Error("Admin MFA required");
            }
            
            // Verify the MFA code
            const verified = speakeasy.totp.verify({
              secret: user.mfaSecret,
              encoding: 'base32',
              token: credentials.mfaCode,
              window: 2, // allow 2 steps before/after (more tolerance)
            });
            
            if (!verified) {
              throw new Error("Invalid MFA code");
            }
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isApproved: user.isApproved,
          mfaEnabled: user.mfaEnabled,
        };
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isApproved = user.isApproved;
        token.mfaEnabled = user.mfaEnabled;
        // Determine if user is admin based on role
        token.isAdmin = user.role === 'admin';
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isApproved = token.isApproved as boolean;
        session.user.mfaEnabled = token.mfaEnabled as boolean;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  }
};
