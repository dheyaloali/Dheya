const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const salaries = await prisma.salary.findMany({ where: { startDate: null, endDate: null } });
  for (const salary of salaries) {
    const payDate = new Date(salary.payDate);
    const startDate = new Date(payDate.getFullYear(), payDate.getMonth(), 1);
    const endDate = new Date(payDate.getFullYear(), payDate.getMonth() + 1, 0); // last day of month
    await prisma.salary.update({
      where: { id: salary.id },
      data: { startDate, endDate },
    });
  }
  console.log(`Backfilled ${salaries.length} salary records.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect()); 