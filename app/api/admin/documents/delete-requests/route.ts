import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// GET: List all document delete requests (admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const requests = await prisma.documentDeleteRequest.findMany({
    orderBy: [
      { status: "asc" }, // pending first
      { createdAt: "desc" },
    ],
    include: {
      document: true,
      employee: { include: { user: true } },
    },
  });
  return NextResponse.json({ requests });
} 