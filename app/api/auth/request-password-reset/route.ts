import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendEmail } from "@/lib/email"; // You should implement this helper using your email provider
import { checkRateLimit } from '@/lib/rateLimiter';

const RESET_TOKEN_EXPIRY_MINUTES = 30;

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

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 reset requests per hour per IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip, { windowMs: 60 * 60 * 1000, max: 5 })) {
      return NextResponse.json({ success: false, message: "Too many reset requests. Please try again later." }, { status: 429 });
    }
    const { email, recaptchaToken } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
    }
    if (!recaptchaToken) {
      return NextResponse.json({ success: false, message: "reCAPTCHA is required." }, { status: 400 });
    }
    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return NextResponse.json({ success: false, message: "Invalid reCAPTCHA." }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Do not reveal if user exists
      return NextResponse.json({ success: true, message: "If an account exists with this email, you will receive a password reset link." });
    }
    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
    // Store token and expiry
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpires: expires,
      },
    });
    // Build reset link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password/${token}`;
    // Send email (implement sendEmail for your provider)
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        html: `<p>You requested a password reset. Click the link below to reset your password. This link will expire in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.</p><p><a href="${resetLink}">${resetLink}</a></p>`
      });
    } catch (emailErr) {
      console.error("[Password Reset] Failed to send email:", emailErr);
      // Do not reveal email errors to user
    }
    return NextResponse.json({ success: true, message: "If an account exists with this email, you will receive a password reset link." });
  } catch (error) {
    console.error("[Password Reset Request] Error:", error);
    return NextResponse.json({ success: false, message: "An error occurred while processing your request." }, { status: 500 });
  }
} 