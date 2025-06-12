import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  console.log("Salaries API endpoint called");
  try {
    const auth = await requireAuth(req, true);
    
    // Debug auth response
    console.log("Auth check result:", {
      ok: auth.ok,
      status: auth.status,
      message: auth.message
    });
    
    if (!auth.ok) {
      console.error("Authentication failed:", auth.message, "Status:", auth.status);
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);

    console.log("Fetching salaries with params:", { page, pageSize });

    try {
      const [salaries, total] = await Promise.all([
        prisma.salary.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: { employee: { include: { user: true } } }
        }),
        prisma.salary.count()
      ]);

      console.log(`Found ${salaries.length} salaries out of ${total} total`);
      return NextResponse.json({ salaries, total, page, pageSize });
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
  } catch (error) {
    console.error("Unexpected error in salaries API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 