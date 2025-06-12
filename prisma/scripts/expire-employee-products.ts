import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function expireAssignments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Find all assignments for today that are still assigned or partially_sold
  const assignments = await prisma.employeeProduct.findMany({
    where: {
      assignedAt: { gte: today, lt: tomorrow },
      OR: [
        { status: "assigned" },
        { status: "partially_sold" }
      ]
    },
  });

  for (const assignment of assignments) {
    // Sum up all sales for this employee/product for today
    const sales = await prisma.sale.aggregate({
      where: {
        employeeId: assignment.employeeId,
        productId: assignment.productId,
        date: { gte: today, lt: tomorrow },
      },
      _sum: { quantity: true },
    });
    const soldQuantity = sales._sum.quantity || 0;
    const expiredQuantity = assignment.quantity - soldQuantity;

    let status = assignment.status;
    if (soldQuantity === 0) {
      status = "expired";
    } else if (soldQuantity < assignment.quantity) {
      status = "partially_sold";
    } else if (soldQuantity === assignment.quantity) {
      status = "sold";
    }

    await prisma.employeeProduct.update({
      where: { id: assignment.id },
      data: {
        status,
        expiredQuantity: expiredQuantity > 0 ? expiredQuantity : 0,
      },
    });
  }
  console.log("Employee product assignments processed for expiry.");
}

expireAssignments().finally(() => prisma.$disconnect()); 