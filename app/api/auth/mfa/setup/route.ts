import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

/**
 * POST /api/auth/mfa/setup
 * Body: { email: string }
 *
 * Generates a TOTP secret for the admin, stores it in the database,
 * and returns a QR code data URL and the secret for backup.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  // Find the user and ensure they are admin
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'User not found or not admin.' }, { status: 403 });
  }

  // Generate a TOTP secret
  const secret = speakeasy.generateSecret({
    name: `EmployeeManagementSystem (${email})`,
  });

  // Store the secret in the database
  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaSecret: secret.base32,
      mfaEnabled: false, // Will be set to true after verification
    },
  });

  // Generate a QR code for the secret
  const otpauthUrl = secret.otpauth_url;
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

  return NextResponse.json({
    qrCodeDataUrl,
    secret: secret.base32, // Show for backup purposes
    message: 'Scan the QR code with your authenticator app and verify to enable MFA.'
  });
} 