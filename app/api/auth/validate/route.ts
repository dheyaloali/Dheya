import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from '@/lib/rateLimiter';

export async function POST(req: NextRequest) {
  // Rate limiting: 5 reset attempts per minute per IP
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  if (!checkRateLimit(ip, { windowMs: 60_000, max: 5 })) {
    return NextResponse.json({ valid: false, error: "Too many reset attempts. Please try again later." }, { status: 429 });
  }

  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ valid: false });

  const isMatch = await bcrypt.compare(password, user.password);
  return NextResponse.json({ valid: isMatch });
}