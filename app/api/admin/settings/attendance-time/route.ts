import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from '@/lib/prisma';

const SINGLETON_ID = 1;

// GET: Retrieve current attendance time settings
export async function GET(req: NextRequest) {
  console.log("API: Attendance Time GET called");
  const auth = await requireAuth(req, true);
  console.log("API: Auth result", auth);

  if (!auth.ok) {
    console.log("API: Auth failed");
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    console.log("API: Fetching settings by id...");
    const settings = await prisma.settings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
    console.log("API: Settings result", settings);
    console.log("API: Returning settings response");
    return NextResponse.json({
      workStartTime: settings.workStartTime,
      workEndTime: settings.workEndTime,
      lateThreshold: settings.lateThreshold,
      gracePeriod: settings.gracePeriod,
      checkInWindowStart: settings.checkInWindowStart,
      checkInWindowEnd: settings.checkInWindowEnd,
      checkOutWindowStart: settings.checkOutWindowStart,
      checkOutWindowEnd: settings.checkOutWindowEnd,
      autoMarkAbsent: settings.autoMarkAbsent,
      weekendWorkEnabled: settings.weekendWorkEnabled,
      holidayWorkEnabled: settings.holidayWorkEnabled,
    });
  } catch (error) {
    console.error("Error fetching attendance settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT: Update attendance time settings
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const {
      workStartTime,
      workEndTime,
      lateThreshold,
      gracePeriod,
      checkInWindowStart,
      checkInWindowEnd,
      checkOutWindowStart,
      checkOutWindowEnd,
      autoMarkAbsent,
      weekendWorkEnabled,
      holidayWorkEnabled,
    } = await req.json();

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const timeFields = [
      { name: 'workStartTime', value: workStartTime },
      { name: 'workEndTime', value: workEndTime },
      { name: 'checkInWindowStart', value: checkInWindowStart },
      { name: 'checkInWindowEnd', value: checkInWindowEnd },
      { name: 'checkOutWindowStart', value: checkOutWindowStart },
      { name: 'checkOutWindowEnd', value: checkOutWindowEnd },
    ];

    for (const field of timeFields) {
      if (field.value && !timeRegex.test(field.value)) {
        return NextResponse.json({ 
          error: `Invalid time format for ${field.name}. Use HH:MM format (e.g., 09:00)` 
        }, { status: 400 });
      }
    }

    if (lateThreshold !== undefined && (lateThreshold < 0 || lateThreshold > 120)) {
      return NextResponse.json({ 
        error: "Late threshold must be between 0 and 120 minutes" 
      }, { status: 400 });
    }

    if (gracePeriod !== undefined && (gracePeriod < 0 || gracePeriod > 60)) {
      return NextResponse.json({ 
        error: "Grace period must be between 0 and 60 minutes" 
      }, { status: 400 });
    }

    if (workStartTime && workEndTime) {
      const start = new Date(`2000-01-01T${workStartTime}`);
      const end = new Date(`2000-01-01T${workEndTime}`);
      if (start >= end) {
        return NextResponse.json({ 
          error: "Work end time must be after work start time" 
        }, { status: 400 });
      }
    }

    if (checkInWindowStart && checkInWindowEnd) {
      const start = new Date(`2000-01-01T${checkInWindowStart}`);
      const end = new Date(`2000-01-01T${checkInWindowEnd}`);
      if (start >= end) {
        return NextResponse.json({ 
          error: "Check-in window end must be after check-in window start" 
        }, { status: 400 });
      }
    }

    if (checkOutWindowStart && checkOutWindowEnd) {
      const start = new Date(`2000-01-01T${checkOutWindowStart}`);
      const end = new Date(`2000-01-01T${checkOutWindowEnd}`);
      if (start >= end) {
        return NextResponse.json({ 
          error: "Check-out window end must be after check-out window start" 
        }, { status: 400 });
      }
    }

    // Always update the singleton row by id
    const settings = await prisma.settings.upsert({
      where: { id: SINGLETON_ID },
      update: {
        ...(workStartTime !== undefined && { workStartTime }),
        ...(workEndTime !== undefined && { workEndTime }),
        ...(lateThreshold !== undefined && { lateThreshold }),
        ...(gracePeriod !== undefined && { gracePeriod }),
        ...(checkInWindowStart !== undefined && { checkInWindowStart }),
        ...(checkInWindowEnd !== undefined && { checkInWindowEnd }),
        ...(checkOutWindowStart !== undefined && { checkOutWindowStart }),
        ...(checkOutWindowEnd !== undefined && { checkOutWindowEnd }),
        ...(autoMarkAbsent !== undefined && { autoMarkAbsent }),
        ...(weekendWorkEnabled !== undefined && { weekendWorkEnabled }),
        ...(holidayWorkEnabled !== undefined && { holidayWorkEnabled }),
      },
      create: {
        id: SINGLETON_ID,
        workStartTime: workStartTime || "09:00",
        workEndTime: workEndTime || "17:00",
        lateThreshold: lateThreshold ?? 15,
        gracePeriod: gracePeriod ?? 5,
        checkInWindowStart: checkInWindowStart || "07:00",
        checkInWindowEnd: checkInWindowEnd || "20:00",
        checkOutWindowStart: checkOutWindowStart || "16:00",
        checkOutWindowEnd: checkOutWindowEnd || "23:59",
        autoMarkAbsent: autoMarkAbsent ?? true,
        weekendWorkEnabled: weekendWorkEnabled ?? false,
        holidayWorkEnabled: holidayWorkEnabled ?? false,
      },
    });

    return NextResponse.json({
      success: true,
      settings: {
        workStartTime: settings.workStartTime,
        workEndTime: settings.workEndTime,
        lateThreshold: settings.lateThreshold,
        gracePeriod: settings.gracePeriod,
        checkInWindowStart: settings.checkInWindowStart,
        checkInWindowEnd: settings.checkInWindowEnd,
        checkOutWindowStart: settings.checkOutWindowStart,
        checkOutWindowEnd: settings.checkOutWindowEnd,
        autoMarkAbsent: settings.autoMarkAbsent,
        weekendWorkEnabled: settings.weekendWorkEnabled,
        holidayWorkEnabled: settings.holidayWorkEnabled,
      }
    });
  } catch (error) {
    console.error("Error updating attendance settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
} 