import { NextRequest, NextResponse } from "next/server";
import { generateVerificationToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from '@/lib/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 3 resend attempts per hour per IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip, { windowMs: 60 * 60 * 1000, max: 3 })) {
      console.log("[EMAIL_VERIFICATION_RESEND] Rate limit exceeded for IP:", ip);
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }
    
    const { email } = await req.json();
    
    if (!email) {
      console.log("[EMAIL_VERIFICATION_RESEND] Missing email in request");
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }
    
    console.log("[EMAIL_VERIFICATION_RESEND] Processing resend request for:", email);
    
    // Generate a new verification token
    const token = await generateVerificationToken(email);
    
    if (!token) {
      console.log("[EMAIL_VERIFICATION_RESEND] No user found for email:", email);
      // Don't reveal if user exists
      return NextResponse.json({ success: true, message: "If your email exists in our system, a verification link has been sent." });
    }
    
    console.log("[EMAIL_VERIFICATION_RESEND] Generated new token for:", email);
    
    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verificationLink = `${baseUrl}/verify-email/${token}`;
    
    await sendEmail({
      to: email,
      subject: "Verify your email address",
      html: `
        <h1>Email Verification</h1>
        <p>You requested a new verification link for your Employee Management System account.</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationLink}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${verificationLink}</p>
        <p>This link will expire in 24 hours.</p>
      `
    });
    
    console.log("[EMAIL_VERIFICATION_RESEND] Verification email sent successfully to:", email);
    
    return NextResponse.json({
      success: true,
      message: "If your email exists in our system, a verification link has been sent."
    });
  } catch (error) {
    console.error("[EMAIL_VERIFICATION_RESEND] Error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
} 