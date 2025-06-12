import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

const prisma = new PrismaClient();

interface AssignmentData {
  employeeId: number;
  productId: number;
  quantity: number;
}

// Validate an assignment data object
function validateAssignment(data: any): { valid: boolean; message?: string } {
  if (!data.employeeId || typeof data.employeeId !== 'number') {
    return { valid: false, message: "employeeId is required and must be a number" };
  }
  if (!data.productId || typeof data.productId !== 'number') {
    return { valid: false, message: "productId is required and must be a number" };
  }
  if (!data.quantity || typeof data.quantity !== 'number' || data.quantity <= 0) {
    return { valid: false, message: "quantity is required and must be a positive number" };
  }
  return { valid: true };
}

// GET: List all product assignments with filtering options
export async function GET(req: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAuth(req, true); 
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    if (!auth.session?.user) {
      console.error("Authenticated user missing in requireAuth result:", auth);
      return NextResponse.json({ error: "Authenticated user missing" }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const productId = searchParams.get("productId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Build where condition based on filters
    const where: any = {};
    if (employeeId) where.employeeId = parseInt(employeeId, 10);
    if (productId) where.productId = parseInt(productId, 10);
    if (dateFrom || dateTo) {
      where.assignedAt = {};
      if (dateFrom) where.assignedAt.gte = new Date(dateFrom);
      if (dateTo) where.assignedAt.lte = new Date(dateTo);
    }

    // Fetch assignments with pagination
    const [assignments, total] = await Promise.all([
      prisma.employeeProduct.findMany({
        where,
        include: {
          employee: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          product: true,
        },
        orderBy: { assignedAt: "desc" },
        skip,
        take,
      }),
      prisma.employeeProduct.count({ where }),
    ]);

    // Format the response data for easier frontend consumption
    const formattedAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      employeeId: assignment.employeeId,
      employeeName: assignment.employee.user.name,
      employeeEmail: assignment.employee.user.email,
      employeeImage: assignment.employee.user.image,
      productId: assignment.productId,
      productName: assignment.product.name,
      productPrice: assignment.product.price,
      quantity: assignment.quantity,
      assignedAt: assignment.assignedAt,
      totalValue: assignment.quantity * assignment.product.price,
    }));

    return NextResponse.json({
      assignments: formattedAssignments,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error in GET /api/admin/assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST: Create a new product assignment
export async function POST(req: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAuth(req, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    if (!auth.session?.user) {
      console.error("Authenticated user missing in requireAuth result:", auth);
      return NextResponse.json({ error: "Authenticated user missing" }, { status: 500 });
    }

    // Parse and validate request body
    const data = await req.json();
    const validation = validateAssignment(data);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      );
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Check if an assignment already exists
    const now = new Date();
    const assignedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const existingAssignment = await prisma.employeeProduct.findFirst({
      where: {
          employeeId: data.employeeId,
          productId: data.productId,
        assignedAt,
      },
    });

    let assignment;
    if (existingAssignment) {
      // Update existing assignment with new quantity
      assignment = await prisma.employeeProduct.update({
        where: { id: existingAssignment.id },
        data: { quantity: data.quantity },
        include: {
          employee: { include: { user: true } },
          product: true,
        },
      });
    } else {
      // Create new assignment
      assignment = await prisma.employeeProduct.create({
        data: {
          employeeId: data.employeeId,
          productId: data.productId,
          quantity: data.quantity,
          assignedAt,
        },
        include: {
          employee: { include: { user: true } },
          product: true,
        },
      });

      // Log assignment and user info before notification
      console.log("assignment.employeeId:", assignment.employeeId);
      console.log("assignment.employee.user:", assignment.employee?.user);
      console.log("auth.session.user.id:", auth.session.user.id);

      if (assignment.employee && assignment.employee.user && assignment.employeeId && auth.session.user.id) {
        // Notify employee (DB + real-time)
        await notifyUserOrEmployee({
          employeeId: assignment.employeeId,
          type: "employee_product_assigned",
          message: `Product ${assignment.product.name} has been assigned to you by ${auth.session.user.name}.`,
          actionUrl: "/employee/products",
          actionLabel: "View Products",
          broadcastToEmployee: true,
        });

        // Notify admin (DB + real-time)
        await notifyUserOrEmployee({
          userId: auth.session.user.id,
          type: "admin_product_assigned",
          message: `You assigned Product ${assignment.product.name} to ${assignment.employee.user.name}.`,
          actionUrl: `/admin/employees/${assignment.employeeId}`,
          actionLabel: "View Employee",
          broadcastToAdmin: true,
        });
      } else {
        console.error("Assignment missing employee or user info:", assignment);
      }
    }

    // Format the response
    const response = {
      id: assignment.id,
      employeeId: assignment.employeeId,
      employeeName: assignment.employee.user.name,
      productId: assignment.productId,
      productName: assignment.product.name,
      quantity: assignment.quantity,
      assignedAt: assignment.assignedAt,
    };

    return NextResponse.json({ success: true, assignment: response });
  } catch (error) {
    console.error("Error in POST /api/admin/assignments:", error);
    return NextResponse.json(
      { error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing assignment
export async function PUT(req: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAuth(req, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    if (!auth.session?.user) {
      console.error("Authenticated user missing in requireAuth result:", auth);
      return NextResponse.json({ error: "Authenticated user missing" }, { status: 500 });
    }

    // Parse and validate request body
    const data = await req.json();
    if (!data.id || typeof data.id !== 'number') {
      return NextResponse.json(
        { error: "Assignment ID is required" },
        { status: 400 }
      );
    }

    if (data.quantity !== undefined) {
      if (typeof data.quantity !== 'number' || data.quantity <= 0) {
        return NextResponse.json(
          { error: "Quantity must be a positive number" },
          { status: 400 }
        );
      }
    }

    // Check if assignment exists
    const existingAssignment = await prisma.employeeProduct.findUnique({
      where: { id: data.id },
    });
    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Update the assignment
    const updated = await prisma.employeeProduct.update({
      where: { id: data.id },
      data: { 
        quantity: data.quantity,
        // Allow updating other fields if needed in the future
      },
      include: {
        employee: { include: { user: true } },
        product: true,
      },
    });

    // Format the response
    const response = {
      id: updated.id,
      employeeId: updated.employeeId,
      employeeName: updated.employee.user.name,
      productId: updated.productId,
      productName: updated.product.name,
      quantity: updated.quantity,
      assignedAt: updated.assignedAt,
    };

    // After updating the assignment in PUT
    if (updated.employee && updated.employee.user && updated.employeeId && auth.session.user.id) {
      // Notify employee
      await notifyUserOrEmployee({
        employeeId: updated.employeeId,
        type: "employee_product_updated",
        message: `Your product assignment (${updated.product.name}) has been updated by ${auth.session.user.name}.`,
        actionUrl: "/employee/products",
        actionLabel: "View Products",
        broadcastToEmployee: true,
      });

      // Notify admin
      await notifyUserOrEmployee({
        userId: auth.session.user.id,
        type: "admin_product_updated",
        message: `You updated the product assignment (${updated.product.name}) for ${updated.employee.user.name}.`,
        actionUrl: `/admin/employees/${updated.employeeId}`,
        actionLabel: "View Employee",
        broadcastToAdmin: true,
      });
    }

    return NextResponse.json({ success: true, assignment: response });
  } catch (error) {
    console.error("Error in PUT /api/admin/assignments:", error);
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

// DELETE: Remove an assignment
export async function DELETE(req: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAuth(req, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    if (!auth.session?.user) {
      console.error("Authenticated user missing in requireAuth result:", auth);
      return NextResponse.json({ error: "Authenticated user missing" }, { status: 500 });
    }

    // Parse query parameters for the assignment ID
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { error: "Assignment ID is required" },
        { status: 400 }
      );
    }

    // Check if assignment exists
    const assignmentId = parseInt(id, 10);
    const existingAssignment = await prisma.employeeProduct.findUnique({
      where: { id: assignmentId },
    });
    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Delete the assignment
    await prisma.employeeProduct.delete({
      where: { id: assignmentId },
    });

    // After deleting the assignment in DELETE
    if (existingAssignment) {
      const employee = await prisma.employee.findUnique({
        where: { id: existingAssignment.employeeId },
        include: { user: true }
      });
      const product = await prisma.product.findUnique({
        where: { id: existingAssignment.productId }
      });

      if (employee && employee.user && product && auth.session.user.id) {
        // Notify employee
        await notifyUserOrEmployee({
          employeeId: employee.id,
          type: "employee_product_deleted",
          message: `Your product assignment (${product.name}) has been deleted by ${auth.session.user.name}.`,
          actionUrl: "/employee/products",
          actionLabel: "View Products",
          broadcastToEmployee: true,
        });

        // Notify admin
        await notifyUserOrEmployee({
          userId: auth.session.user.id,
          type: "admin_product_deleted",
          message: `You deleted the product assignment (${product.name}) for ${employee.user.name}.`,
          actionUrl: `/admin/employees/${employee.id}`,
          actionLabel: "View Employee",
          broadcastToAdmin: true,
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Assignment deleted successfully",
      deletedId: assignmentId
    });
  } catch (error) {
    console.error("Error in DELETE /api/admin/assignments:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
} 