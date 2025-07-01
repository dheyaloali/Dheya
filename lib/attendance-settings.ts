import prisma from './prisma';

export interface AttendanceSettings {
  workStartTime: string;
  workEndTime: string;
  lateThreshold: number;
  gracePeriod: number;
  checkInWindowStart: string;
  checkInWindowEnd: string;
  checkOutWindowStart: string;
  checkOutWindowEnd: string;
  autoMarkAbsent: boolean;
  weekendWorkEnabled: boolean;
  holidayWorkEnabled: boolean;
}

const SINGLETON_ID = 1;

/**
 * Get attendance settings from database
 * Creates default settings if none exist
 */
export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  try {
    // Use upsert with fixed ID to ensure singleton pattern and prevent database locks
    const settings = await prisma.settings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });

    return {
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
    };
  } catch (error) {
    console.error("Error fetching attendance settings:", error);
    // Return default values if database error
    return {
      workStartTime: "09:00",
      workEndTime: "17:00",
      lateThreshold: 15,
      gracePeriod: 5,
      checkInWindowStart: "07:00",
      checkInWindowEnd: "20:00",
      checkOutWindowStart: "16:00",
      checkOutWindowEnd: "23:59",
      autoMarkAbsent: true,
      weekendWorkEnabled: false,
      holidayWorkEnabled: false,
    };
  }
}

/**
 * Check if a given time is within the check-in window
 */
export function isWithinCheckInWindow(checkInTime: Date, settings: AttendanceSettings): boolean {
  const timeString = checkInTime.toTimeString().slice(0, 5); // HH:MM format
  return timeString >= settings.checkInWindowStart && timeString <= settings.checkInWindowEnd;
}

/**
 * Check if a given time is within the check-out window
 */
export function isWithinCheckOutWindow(checkOutTime: Date, settings: AttendanceSettings): boolean {
  const timeString = checkOutTime.toTimeString().slice(0, 5); // HH:MM format
  return timeString >= settings.checkOutWindowStart && timeString <= settings.checkOutWindowEnd;
}

/**
 * Determine if check-in is late based on work start time and threshold
 */
export function isLateCheckIn(checkInTime: Date, settings: AttendanceSettings): boolean {
  const checkInTimeString = checkInTime.toTimeString().slice(0, 5); // HH:MM format
  const workStartTime = new Date(`2000-01-01T${settings.workStartTime}`);
  const checkInTimeDate = new Date(`2000-01-01T${checkInTimeString}`);
  const lateThresholdMs = settings.lateThreshold * 60 * 1000; // Convert minutes to milliseconds
  
  return checkInTimeDate.getTime() > workStartTime.getTime() + lateThresholdMs;
}

/**
 * Calculate work hours based on check-in and check-out times
 */
export function calculateWorkHours(checkInTime: Date, checkOutTime: Date, settings: AttendanceSettings): number {
  if (!checkInTime || !checkOutTime) return 0;
  
  const start = new Date(checkInTime);
  const end = new Date(checkOutTime);
  
  // If check-out is before check-in, assume it's the next day
  if (end < start) {
    end.setDate(end.getDate() + 1);
  }
  
  const workHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, workHours); // Ensure non-negative
}

/**
 * Determine attendance status based on check-in time and settings
 */
export function determineAttendanceStatus(
  checkInTime: Date | null, 
  checkOutTime: Date | null, 
  settings: AttendanceSettings
): 'Present' | 'Late' | 'Absent' {
  if (!checkInTime) return 'Absent';
  
  if (isLateCheckIn(checkInTime, settings)) {
    return 'Late';
  }
  
  return 'Present';
} 