import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// GET: List all document delete requests (admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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