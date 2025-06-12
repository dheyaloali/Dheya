import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  // Find the first admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      // Add any other fields you want to expose
      // You can add timezone, dateFormat, timeFormat if you add them to the User model
    },
  });
  if (!admin) {
    return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
  }
  // Get global settings (create if not exists)
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }
  return NextResponse.json({
    adminName: admin.name,
    adminEmail: admin.email,
    adminPassword: admin.password,
    adminRealtimeEnabled: settings.adminRealtimeEnabled,
    employeeRealtimeEnabled: settings.employeeRealtimeEnabled,
    // timezone, dateFormat, timeFormat if present
  });
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  // Find the first admin user
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) {
    return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
  }
  // Update the admin user fields if present
  const userUpdate: any = {};
  if (typeof data.adminName === 'string') userUpdate.name = data.adminName;
  if (typeof data.adminEmail === 'string') userUpdate.email = data.adminEmail;
  if (typeof data.adminPassword === 'string') userUpdate.password = data.adminPassword;
  let updatedAdmin = admin;
  if (Object.keys(userUpdate).length > 0) {
    updatedAdmin = await prisma.user.update({ where: { id: admin.id }, data: userUpdate });
  }
  // Update or create global settings
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }
  const settingsUpdate: any = {};
  if (typeof data.adminRealtimeEnabled === 'boolean') settingsUpdate.adminRealtimeEnabled = data.adminRealtimeEnabled;
  if (typeof data.employeeRealtimeEnabled === 'boolean') settingsUpdate.employeeRealtimeEnabled = data.employeeRealtimeEnabled;
  let updatedSettings = settings;
  if (Object.keys(settingsUpdate).length > 0) {
    updatedSettings = await prisma.settings.update({ where: { id: settings.id }, data: settingsUpdate });
  }
  return NextResponse.json({
    adminName: updatedAdmin.name,
    adminEmail: updatedAdmin.email,
    adminPassword: updatedAdmin.password,
    adminRealtimeEnabled: updatedSettings.adminRealtimeEnabled,
    employeeRealtimeEnabled: updatedSettings.employeeRealtimeEnabled,
    // timezone, dateFormat, timeFormat if present
  });
} 