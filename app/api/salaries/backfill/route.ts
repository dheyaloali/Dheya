import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    // Find all salary records without a breakdown
    const salaries = await prisma.salary.findMany({
      where: {
        breakdown: {
          equals: Prisma.JsonNull,
        },
      },
    });

    const defaultBreakdown = {
      baseSalary: 0,
      salesTotal: 0,
      bonusPercent: 0,
      totalWorkedHours: 0,
      overtimeRate: 0,
      undertimeDeduction: 0,
      absenceDeduction: 0,
      absentDays: 0,
    };

    // Update each record with the default breakdown, using amount as baseSalary
    const updates = salaries.map((salary: { id: number, amount: number }) =>
      prisma.salary.update({
        where: { id: salary.id },
        data: {
          breakdown: {
            baseSalary: salary.amount,
            salesTotal: 0,
            bonusPercent: 0,
            totalWorkedHours: 0,
            overtimeRate: 0,
            undertimeDeduction: 0,
            absenceDeduction: 0,
            absentDays: 0,
          },
        },
      })
    );

    await Promise.all(updates);

    return NextResponse.json({ message: `Updated ${salaries.length} records` });
  } catch (error) {
    return NextResponse.json({ error: "Failed to backfill records" }, { status: 500 });
  }
} 