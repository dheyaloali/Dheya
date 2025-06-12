import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanDatabase() {
  try {
    // Find the admin user (by role)
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!admin) {
      throw new Error('No admin user found!');
    }

    // Delete all related data for non-admin users
    await prisma.attendance.deleteMany({ where: { employee: { userId: { not: admin.id } } } });
    await prisma.sale.deleteMany({ where: { employee: { userId: { not: admin.id } } } });
    await prisma.document.deleteMany({ where: { employee: { userId: { not: admin.id } } } });
    await prisma.employeeProduct.deleteMany({ where: { employee: { userId: { not: admin.id } } } });
    await prisma.salary.deleteMany({ where: { employee: { userId: { not: admin.id } } } });
    await prisma.timeLog.deleteMany({ where: { employee: { userId: { not: admin.id } } } });
    await prisma.salesRecord.deleteMany({ where: { employee: { userId: { not: admin.id } } } });
    await prisma.absenceRecord.deleteMany({ where: { employee: { userId: { not: admin.id } } } });
    await prisma.employee.deleteMany({ where: { userId: { not: admin.id } } });
    await prisma.user.deleteMany({ where: { id: { not: admin.id } } });
    // await prisma.product.deleteMany({}); // Optional: remove if you want to keep products

    console.log('Database cleaned successfully! Only admin remains.')
  } catch (error) {
    console.error('Error cleaning database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanDatabase() 