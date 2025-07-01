import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// Default settings to use when there's an error or no settings exist
const defaultSettings = {
  adminRealtimeEnabled: true,
  employeeRealtimeEnabled: true,
  lowBatteryAlertsEnabled: true,
  lowBatteryThreshold: 20,
  offlineAlertThreshold: 300,
  offlineAlertsEnabled: true,
  stationaryAlertThreshold: 600,
  stationaryAlertsEnabled: true,
  // Security settings
  passwordPolicy: 'strong',
  mfaEnabled: true,
  sessionTimeout: '30m',
  maxLoginAttempts: '5',
  // Currency settings
  defaultCurrency: 'USD',
  exchangeRate: 1.0,
  currencySymbol: '$',
  currencyCode: 'USD',
  currencyName: 'US Dollar',
  currencyLocale: 'en-US'
};

export async function GET(req: NextRequest) {
  try {
    // Enhanced session validation: Check if user still exists in database
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'SESSION_INVALID' }, { status: 401 });
    }
    
    // Verify user still exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    });
    
    if (!userExists) {
      console.log(`[API] User ${session.user.id} no longer exists in database`);
      return NextResponse.json({ 
        error: 'Unauthorized', 
        code: 'SESSION_INVALID',
        message: 'User account no longer exists'
      }, { status: 401 });
    }
    
    // Check if user is admin
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Find the first admin user
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
      },
    });
    if (!admin) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
    }
    
    // Get settings from database if possible, otherwise use defaults
    let dbSettings = null;
    try {
      // Use raw query to avoid schema validation issues
      const result = await prisma.$queryRaw`SELECT * FROM "Settings" LIMIT 1`;
      if (result && Array.isArray(result) && result.length > 0) {
        dbSettings = result[0];
      }
    } catch (error) {
      console.error('Error fetching settings from database:', error);
    }
    
    // Combine database settings with defaults and admin info
    const settings = {
      // Admin info
      adminName: admin.name,
      adminEmail: admin.email,
      adminPassword: admin.password,
      
      // Use database settings or defaults
      adminRealtimeEnabled: dbSettings?.adminRealtimeEnabled ?? defaultSettings.adminRealtimeEnabled,
      employeeRealtimeEnabled: dbSettings?.employeeRealtimeEnabled ?? defaultSettings.employeeRealtimeEnabled,
      lowBatteryAlertsEnabled: dbSettings?.lowBatteryAlertsEnabled ?? defaultSettings.lowBatteryAlertsEnabled,
      lowBatteryThreshold: dbSettings?.lowBatteryThreshold ?? defaultSettings.lowBatteryThreshold,
      offlineAlertThreshold: dbSettings?.offlineAlertThreshold ?? defaultSettings.offlineAlertThreshold,
      offlineAlertsEnabled: dbSettings?.offlineAlertsEnabled ?? defaultSettings.offlineAlertsEnabled,
      stationaryAlertThreshold: dbSettings?.stationaryAlertThreshold ?? defaultSettings.stationaryAlertThreshold,
      stationaryAlertsEnabled: dbSettings?.stationaryAlertsEnabled ?? defaultSettings.stationaryAlertsEnabled,
      
      // Security settings from database or defaults
      passwordPolicy: dbSettings?.passwordPolicy ?? defaultSettings.passwordPolicy,
      mfaEnabled: dbSettings?.mfaEnabled ?? defaultSettings.mfaEnabled,
      sessionTimeout: dbSettings?.sessionTimeout ?? defaultSettings.sessionTimeout,
      maxLoginAttempts: dbSettings?.maxLoginAttempts ?? defaultSettings.maxLoginAttempts,
      
      // Currency settings from database or defaults
      defaultCurrency: dbSettings?.defaultCurrency ?? defaultSettings.defaultCurrency,
      exchangeRate: dbSettings?.exchangeRate ?? defaultSettings.exchangeRate,
      currencySymbol: dbSettings?.currencySymbol ?? defaultSettings.currencySymbol,
      currencyCode: dbSettings?.currencyCode ?? defaultSettings.currencyCode,
      currencyName: dbSettings?.currencyName ?? defaultSettings.currencyName,
      currencyLocale: dbSettings?.currencyLocale ?? defaultSettings.currencyLocale,
    };
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in settings API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Enhanced session validation: Check if user still exists in database
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'SESSION_INVALID' }, { status: 401 });
    }
    
    // Verify user still exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    });
    
    if (!userExists) {
      console.log(`[API] User ${session.user.id} no longer exists in database`);
      return NextResponse.json({ 
        error: 'Unauthorized', 
        code: 'SESSION_INVALID',
        message: 'User account no longer exists'
      }, { status: 401 });
    }
    
    // Check if user is admin
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
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
    
    // Get current settings from database
    let dbSettings = null;
    let settingsId = 1;
    
    try {
      const result = await prisma.$queryRaw`SELECT * FROM "Settings" LIMIT 1`;
      if (result && Array.isArray(result) && result.length > 0) {
        dbSettings = result[0];
        settingsId = dbSettings.id;
      }
    } catch (error) {
      console.error('Error fetching settings from database:', error);
    }
    
    // Prepare settings update
    const settingsUpdate: any = {};
    
    // Only include fields that exist in the database schema
    if (typeof data.adminRealtimeEnabled === 'boolean') settingsUpdate.adminRealtimeEnabled = data.adminRealtimeEnabled;
    if (typeof data.employeeRealtimeEnabled === 'boolean') settingsUpdate.employeeRealtimeEnabled = data.employeeRealtimeEnabled;
    if (typeof data.stationaryAlertThreshold === 'number') settingsUpdate.stationaryAlertThreshold = data.stationaryAlertThreshold;
    if (typeof data.lowBatteryThreshold === 'number') settingsUpdate.lowBatteryThreshold = data.lowBatteryThreshold;
    if (typeof data.offlineAlertThreshold === 'number') settingsUpdate.offlineAlertThreshold = data.offlineAlertThreshold;
    if (typeof data.stationaryAlertsEnabled === 'boolean') settingsUpdate.stationaryAlertsEnabled = data.stationaryAlertsEnabled;
    if (typeof data.lowBatteryAlertsEnabled === 'boolean') settingsUpdate.lowBatteryAlertsEnabled = data.lowBatteryAlertsEnabled;
    if (typeof data.offlineAlertsEnabled === 'boolean') settingsUpdate.offlineAlertsEnabled = data.offlineAlertsEnabled;
    
    // Include security settings
    if (typeof data.passwordPolicy === 'string') settingsUpdate.passwordPolicy = data.passwordPolicy;
    if (typeof data.mfaEnabled === 'boolean') settingsUpdate.mfaEnabled = data.mfaEnabled;
    if (typeof data.sessionTimeout === 'string') settingsUpdate.sessionTimeout = data.sessionTimeout;
    if (typeof data.maxLoginAttempts === 'string') settingsUpdate.maxLoginAttempts = data.maxLoginAttempts;
    
    // Include currency settings
    if (typeof data.defaultCurrency === 'string') settingsUpdate.defaultCurrency = data.defaultCurrency;
    if (typeof data.exchangeRate === 'number') settingsUpdate.exchangeRate = data.exchangeRate;
    if (typeof data.currencySymbol === 'string') settingsUpdate.currencySymbol = data.currencySymbol;
    if (typeof data.currencyCode === 'string') settingsUpdate.currencyCode = data.currencyCode;
    if (typeof data.currencyName === 'string') settingsUpdate.currencyName = data.currencyName;
    if (typeof data.currencyLocale === 'string') settingsUpdate.currencyLocale = data.currencyLocale;
    
    // Update settings in database if needed
    if (Object.keys(settingsUpdate).length > 0) {
      try {
        if (dbSettings) {
          // Update existing settings
          await prisma.$executeRaw`
            UPDATE "Settings" 
            SET ${prisma.$raw(Object.entries(settingsUpdate).map(([k, v]) => {
              // Handle string values by wrapping them in quotes
              const value = typeof v === 'string' ? `'${v}'` : v;
              return `"${k}" = ${value}`;
            }).join(', '))}
            WHERE id = ${settingsId}
          `;
        } else {
          // Create new settings
          const columns = Object.keys(settingsUpdate).map(k => `"${k}"`).join(', ');
          const values = Object.values(settingsUpdate);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          
          await prisma.$executeRaw`
            INSERT INTO "Settings" (${prisma.$raw(columns)})
            VALUES (${prisma.$raw(placeholders)})
          `;
        }
      } catch (error) {
        console.error('Error updating settings in database:', error);
      }
    }
    
    // Combine updated settings with defaults
    const finalSettings = {
      // Admin info
      adminName: updatedAdmin.name,
      adminEmail: updatedAdmin.email,
      adminPassword: updatedAdmin.password,
      
      // Updated settings or defaults
      adminRealtimeEnabled: data.adminRealtimeEnabled ?? dbSettings?.adminRealtimeEnabled ?? defaultSettings.adminRealtimeEnabled,
      employeeRealtimeEnabled: data.employeeRealtimeEnabled ?? dbSettings?.employeeRealtimeEnabled ?? defaultSettings.employeeRealtimeEnabled,
      lowBatteryAlertsEnabled: data.lowBatteryAlertsEnabled ?? dbSettings?.lowBatteryAlertsEnabled ?? defaultSettings.lowBatteryAlertsEnabled,
      lowBatteryThreshold: data.lowBatteryThreshold ?? dbSettings?.lowBatteryThreshold ?? defaultSettings.lowBatteryThreshold,
      offlineAlertThreshold: data.offlineAlertThreshold ?? dbSettings?.offlineAlertThreshold ?? defaultSettings.offlineAlertThreshold,
      offlineAlertsEnabled: data.offlineAlertsEnabled ?? dbSettings?.offlineAlertsEnabled ?? defaultSettings.offlineAlertsEnabled,
      stationaryAlertThreshold: data.stationaryAlertThreshold ?? dbSettings?.stationaryAlertThreshold ?? defaultSettings.stationaryAlertThreshold,
      stationaryAlertsEnabled: data.stationaryAlertsEnabled ?? dbSettings?.stationaryAlertsEnabled ?? defaultSettings.stationaryAlertsEnabled,
      
      // Security settings
      passwordPolicy: data.passwordPolicy ?? dbSettings?.passwordPolicy ?? defaultSettings.passwordPolicy,
      mfaEnabled: data.mfaEnabled ?? dbSettings?.mfaEnabled ?? defaultSettings.mfaEnabled,
      sessionTimeout: data.sessionTimeout ?? dbSettings?.sessionTimeout ?? defaultSettings.sessionTimeout,
      maxLoginAttempts: data.maxLoginAttempts ?? dbSettings?.maxLoginAttempts ?? defaultSettings.maxLoginAttempts,
      
      // Currency settings
      defaultCurrency: data.defaultCurrency ?? dbSettings?.defaultCurrency ?? defaultSettings.defaultCurrency,
      exchangeRate: data.exchangeRate ?? dbSettings?.exchangeRate ?? defaultSettings.exchangeRate,
      currencySymbol: data.currencySymbol ?? dbSettings?.currencySymbol ?? defaultSettings.currencySymbol,
      currencyCode: data.currencyCode ?? dbSettings?.currencyCode ?? defaultSettings.currencyCode,
      currencyName: data.currencyName ?? dbSettings?.currencyName ?? defaultSettings.currencyName,
      currencyLocale: data.currencyLocale ?? dbSettings?.currencyLocale ?? defaultSettings.currencyLocale,
    };
    
    return NextResponse.json(finalSettings);
  } catch (error) {
    console.error('Error in settings API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 