import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import speakeasy from 'speakeasy';

/**
 * POST /api/auth/mfa/verify
 * Body: { email: string, token: string }
 *
 * Verifies the TOTP code for the admin. If valid, enables MFA for the user.
 */
export async function POST(req: NextRequest) {
  const { email, token } = await req.json();
  console.log('MFA VERIFY:', { email, token });
  if (!email || !token) {
    return NextResponse.json({ error: 'Email and token are required.' }, { status: 400 });
  }

  // Find the user and ensure they are admin
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  console.log('MFA VERIFY USER:', user);
  if (!user || user.role !== 'admin' || !user.mfaSecret) {
    return NextResponse.json({ error: 'User not found, not admin, or MFA not set up.' }, { status: 403 });
  }

  // Verify the TOTP code
  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token,
    window: 1, // allow 1 step before/after
  });
  console.log('MFA VERIFY RESULT:', verified);

  if (!verified) {
    return NextResponse.json({ success: false, error: 'Invalid MFA code.' }, { status: 401 });
  }

  // Enable MFA for the user
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true },
  });

  return NextResponse.json({ success: true, message: 'MFA enabled successfully.' });
} 