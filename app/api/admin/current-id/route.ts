import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) return NextResponse.json({ error: "No admin found" }, { status: 404 });
  return NextResponse.json({ adminUserId: admin.id });
} 