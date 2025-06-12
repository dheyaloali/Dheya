import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { promises as fs } from "fs"
import path from "path"

export async function GET(request: NextRequest) {
  // Require admin authentication
  const auth = await requireAuth(request, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const statusRaw = searchParams.get("status");
    const status = statusRaw || undefined;
    const search = searchParams.get("search") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    
    // Calculate pagination values
    const skip = (page - 1) * limit;
    
    // Build the filter
    const filter: any = {};
    
    if (status && status !== "all" && status !== "All") {
      filter.status = status;
    }
    
    if (employeeId) {
      filter.employeeId = parseInt(employeeId);
    }
    
    // Handle document type filtering
    const types = searchParams.get("types");
    if (types) {
      const typeArray = types.split(',');
      // Only allow 'passport' and 'national_id' - already enforced by the enum in Prisma
      const allowedTypes = ["passport", "national_id"];
      if (typeArray.some(t => !allowedTypes.includes(t))) {
        console.log("Invalid document type in filter:", typeArray);
        // Don't return an error, just filter out invalid types
        const validTypes = typeArray.filter(t => allowedTypes.includes(t));
        if (validTypes.length > 0) {
          filter.type = { in: validTypes };
        }
      } else if (typeArray.length > 0) {
        filter.type = { in: typeArray };
      }
    }
    
    // Handle registration document filtering
    const isRegistrationDocument = searchParams.get("isRegistrationDocument");
    console.log("isRegistrationDocument param:", isRegistrationDocument);
    if (isRegistrationDocument === "true") {
      filter.isRegistrationDocument = true;
    }
    
    if (search) {
      // Option 1: Try both case variations
      const searchLower = search.toLowerCase();
      const searchUpper = search.toUpperCase();
      
      filter.OR = [
        // Try various case combinations
        { title: { contains: search } },
        { title: { contains: searchLower } },
        { title: { contains: searchUpper } },
        { description: { contains: search } },
        { description: { contains: searchLower } },
        { description: { contains: searchUpper } },
        { type: { contains: search } },
        { type: { contains: searchLower } },
        { type: { contains: searchUpper } }
      ];
    }

    // Log the final filter object for debugging
    console.log("Final filter object:", JSON.stringify(filter, null, 2));

    // Fetch documents with pagination and filters
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: filter,
        include: {
          employee: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                }
              }
            }
          }
        },
        skip,
        take: limit,
        orderBy: { uploadedAt: 'desc' }
      }),
      prisma.document.count({ where: filter })
    ]);

    // Map the documents to include employee name
    const mappedDocuments = documents.map(doc => ({
      ...doc,
      employeeName: doc.employee.user.name || doc.employee.user.email,
      date: doc.uploadedAt,
      employee: undefined  // Remove the nested employee object from response
    }));

    return NextResponse.json({
      documents: mappedDocuments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Require admin authentication
  const auth = await requireAuth(request, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const employeeId = formData.get("employeeId") as string;
    const type = formData.get("type") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const uploadedDuring = formData.get("uploadedDuring") as string | null;
    const file = formData.get("file") as File | null;

    // Validate required fields
    if (!employeeId || !type || !title || !file) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!['passport', 'national_id'].includes(type)) {
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

    // Create the document
    const document = await prisma.document.create({
      data: {
        title,
        employeeId: parseInt(employeeId),
        type: type as any,
        description,
        uploadedDuring: uploadedDuring || undefined,
        fileUrl,
        status: "Pending",
      },
    });
    return NextResponse.json(document);
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}