import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";
import { notifyUserOrEmployee } from "@/lib/notifications";
import { checkRateLimit } from '@/lib/rateLimiter';

// GET: List all documents for the logged-in employee (paginated, filterable)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { user: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where = { employeeId: employee.id } as any;
  if (type && type !== "all") where.type = type;
  if (status && status !== "all") where.status = status;
  if (startDate && endDate) {
    where.uploadedAt = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const total = await prisma.document.count({ where });
  const documents = await prisma.document.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      uploadedAt: true,
      fileUrl: true,
      description: true,
    },
  });

  return NextResponse.json({
    documents,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// POST: Upload a new document for the logged-in employee
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  // Rate limiting: 5 uploads per hour per user
  if (!checkRateLimit(`upload:${userId}`, { windowMs: 60 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  }
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { user: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Parse form data (multipart)
  const formData = await req.formData();
  const title = formData.get("title") as string;
  const type = formData.get("type") as string;
  const description = formData.get("description") as string;
  const file = formData.get("file") as File;
  if (!title || !type || !file) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  // Validate type
  if (!['passport', 'national_id'].includes(type)) {
    // Log suspicious attempt
    console.warn(`Suspicious document type upload attempt by user ${userId}: ${type}`);
    return NextResponse.json({ error: "Invalid document type. Only Passport or National ID allowed." }, { status: 400 });
  }
  // Validate file type and size
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
  ];
  if (!allowedMimeTypes.includes(file.type)) {
    // Log suspicious attempt
    console.warn(`Suspicious file type upload attempt by user ${userId}: ${file.type}`);
    return NextResponse.json({ error: "Only image or PDF files are allowed." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    return NextResponse.json({ error: "File size must be under 5MB." }, { status: 400 });
  }
  // Sanitize file name
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}_${safeName}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, fileName);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
  const fileUrl = `/uploads/${fileName}`;

  const document = await prisma.document.create({
    data: {
      employeeId: employee.id,
      title,
      type,
      description,
      uploadedAt: new Date(),
      status: "pending",
      fileUrl,
    },
  });
  // Notify admin after upload
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (admin) {
    await notifyUserOrEmployee({
      userId: admin.id,
      type: "admin_document_uploaded",
      message: `Employee ${employee.user?.name || employee.user?.email} uploaded a new document: '${document.title}'.`,
      actionUrl: `/admin/employees/${employee.id}/details`,
      actionLabel: "View Employee",
    });
  }
  await notifyUserOrEmployee({
    employeeId: employee.id,
    type: "employee_document_uploaded",
    message: `You uploaded a new document: '${document.title}'.`,
    actionUrl: "/employee/documents",
    actionLabel: "View Documents",
  });
  return NextResponse.json(document);
} 