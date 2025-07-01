import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const id = parseInt(context.params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const salary = await prisma.salary.findUnique({ where: { id } });
  if (!salary) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const metadata = (salary.metadata && typeof salary.metadata === 'object') ? salary.metadata : {};
  return NextResponse.json({ ...salary, ...metadata });
}