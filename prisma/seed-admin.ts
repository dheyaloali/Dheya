import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';

const prisma = new PrismaClient();

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || 'Admin123!@#';
  const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+6281234567890';

  // Remove any existing admin with the same email
  await prisma.user.deleteMany({ where: { email: adminEmail, role: 'admin' } });

  const adminPassword = await bcrypt.hash(adminPasswordPlain, 10);
  const adminMfaSecret = speakeasy.generateSecret({ name: `EMS Admin (${adminEmail})` });

  await prisma.user.create({
    data: {
      name: 'Admin User',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      status: 'active',
      mfaEnabled: false,
      mfaSecret: adminMfaSecret.base32,
      phoneNumber: adminPhone,
    },
  });

  console.log('Admin seeded successfully!');
  console.log(`Admin login: email: ${adminEmail} | password: ${adminPasswordPlain}`);
  console.log('Admin MFA setup:');
  console.log(`Secret (base32): ${adminMfaSecret.base32}`);
  console.log(`otpauth URL: ${adminMfaSecret.otpauth_url}`);
}

async function main() {
  try {
    await seedAdmin();
  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 