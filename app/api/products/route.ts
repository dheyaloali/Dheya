import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const skip = (page - 1) * pageSize;

    const [total, products] = await Promise.all([
      prisma.product.count(),
      prisma.product.findMany({
        skip,
        take: pageSize,
        orderBy: { id: "desc" },
      }),
    ]);
    return NextResponse.json({ products, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { name, description, price, stockLevel, imageUrl } = await req.json();
    if (!name || price === undefined || stockLevel === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // Check for duplicate name (case-insensitive)
    const all = await prisma.product.findMany();
    const exists = all.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      return NextResponse.json({ error: 'A product with this name already exists.' }, { status: 409 });
    }
    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        price,
        stockLevel: stockLevel || 0,
        imageUrl: imageUrl || null,
      }
    });
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { id, name, description, price, stockLevel, imageUrl } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }
    const updated = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        name,
        description,
        price,
        stockLevel,
        imageUrl,
      },
    });
    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    console.error("PUT /api/products error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
} 