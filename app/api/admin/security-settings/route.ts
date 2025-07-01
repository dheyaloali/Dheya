import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { authOptions } from '@/lib/auth';

const securitySettingsSchema = z.object({
  requireMfa: z.boolean().optional(),
  passwordMinLength: z.number().min(8).max(30).optional(),
  passwordRequireSpecialChar: z.boolean().optional(),
  passwordRequireNumber: z.boolean().optional(),
  passwordRequireUppercase: z.boolean().optional(),
  sessionTimeout: z.number().min(5).max(1440).optional(), // minutes
  maxLoginAttempts: z.number().min(3).max(10).optional(),
  recaptchaEnabled: z.boolean().optional(),
  recaptchaSiteKey: z.string().optional(),
  recaptchaSecretKey: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.securitySettings.findFirst({
      where: { id: 1 }, // Using a singleton pattern for security settings
    }) || {};

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching security settings:', error);
    return NextResponse.json({ error: 'Failed to fetch security settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    const validatedData = securitySettingsSchema.parse(data);
    
    // Update or create security settings
    const settings = await prisma.securitySettings.upsert({
      where: { id: 1 }, // Using a singleton pattern
      update: validatedData,
      create: {
        id: 1,
        ...validatedData,
      },
    });

    // Log the security settings change
    await auditLog({
      action: 'SECURITY_SETTINGS_UPDATED',
      userId: session.user.id,
      details: { updatedFields: Object.keys(validatedData) },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating security settings:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update security settings' }, { status: 500 });
  }
} 