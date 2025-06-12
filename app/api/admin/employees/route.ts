import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAuth(req, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || "";
    const city = searchParams.get("city");
    console.log("[DEBUG] Search parameter:", search); // Debug log
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Build where condition for search and city
    let where = {};
    if (search && city && city !== "All") {
      where = {
        city,
          OR: [
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
          { position: { contains: search } },
        ],
      };
    } else if (search) {
      where = {
        OR: [
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
          { position: { contains: search } },
          { city: { contains: search } },
          ],
      };
    } else if (city && city !== "All") {
      where = { city };
    }

    // Fetch employees with pagination and product assignments
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              image: true,
            },
          },
          employeeProducts: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { id: "asc" },
        skip,
        take,
      }),
      prisma.employee.count({ where }),
    ]);
    console.log("[DEBUG] Filtered employees:", employees.map(e => e.user.name)); // Debug log

    // After fetching employees, sort so name matches come first
    const isNameMatch = (employee) =>
      search && employee.user.name && employee.user.name.toLowerCase().includes(search.toLowerCase());
    const sortedEmployees = employees.sort((a, b) => {
      const aNameMatch = isNameMatch(a);
      const bNameMatch = isNameMatch(b);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      return 0;
    });

    // Transform the data to include simplified product assignments
    const formattedEmployees = sortedEmployees.map((employee) => ({
      ...employee,
      assignedProducts: employee.employeeProducts.map((ep) => ({
        id: ep.product.id,
        name: ep.product.name,
        price: ep.product.price,
        quantity: ep.quantity,
        assignedAt: ep.assignedAt,
      })),
      // Remove the detailed employeeProducts to avoid redundancy
      employeeProducts: undefined,
    }));

    return NextResponse.json({
      employees: formattedEmployees,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error in GET /api/admin/employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
} 