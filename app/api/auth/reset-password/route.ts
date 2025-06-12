import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isPasswordComplex, passwordComplexityMessage } from "@/lib/passwordUtils";
import { notifyUserOrEmployee } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) {
      return NextResponse.json({ success: false, message: "Missing token or new password." }, { status: 400 });
    }
    // Find user by reset token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });
    if (!user) {
      return NextResponse.json({ success: false, message: "Invalid or expired token." }, { status: 400 });
    }
    // Enforce password complexity
    if (!isPasswordComplex(newPassword)) {
      return NextResponse.json({ success: false, message: passwordComplexityMessage() }, { status: 400 });
    }
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Update password and invalidate token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
    // Send notification (robust, actionable)
    try {
      await notifyUserOrEmployee({
        userId: user.id,
        type: "password_reset",
        message: "Your password was reset successfully.",
        actionUrl: "/login",
        actionLabel: "Go to Login",
      });
    } catch (notifyErr) {
      console.error("[Notification] Failed to notify user of password reset:", notifyErr);
    }
    return NextResponse.json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return NextResponse.json({ success: false, message: "Password reset failed." }, { status: 500 });
  }
} 