import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import puppeteer from "puppeteer";
import { requireAuth } from "@/lib/auth-guard";

// API route to export dashboard report as a downloadable PDF

export async function POST(req: Request) {
  // Require admin authentication
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { chartImage, attendanceChartImage } = await req.json();
    // --- Fetch Dashboard Stats (same as dashboard-stats route) ---
    const totalEmployees = await prisma.employee.count();
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(now.getMonth() - 1);
    const employeeGrowth = await prisma.employee.count({
      where: { joinDate: { gte: lastMonth } },
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceToday = await prisma.attendance.count({
      where: { date: { gte: today } },
    });
    const attendanceRate = totalEmployees > 0 ? Math.round((attendanceToday / totalEmployees) * 100) : 0;
    const sales = await prisma.sale.findMany();
    const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
    const lastMonthSales = sales.filter(sale => sale.date >= lastMonth);
    const prevMonth = new Date(lastMonth);
    prevMonth.setMonth(lastMonth.getMonth() - 1);
    const prevMonthSales = sales.filter(sale => sale.date >= prevMonth && sale.date < lastMonth);
    const lastMonthTotal = lastMonthSales.reduce((sum, sale) => sum + sale.amount, 0);
    const prevMonthTotal = prevMonthSales.reduce((sum, sale) => sum + sale.amount, 0);
    const salesGrowth = prevMonthTotal > 0 ? Math.round(((lastMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : 0;
    const pendingSalaries = sales.filter(sale => sale.notes?.toLowerCase().includes('pending')).reduce((sum, sale) => sum + sale.amount, 0);
    const pendingSalariesCount = sales.filter(sale => sale.notes?.toLowerCase().includes('pending')).length;
    const stats = {
      totalEmployees,
      employeeGrowth,
      attendanceToday,
      attendanceRate,
      totalSales,
      salesGrowth,
      pendingSalaries,
      pendingSalariesCount,
    };

    // --- Fetch Top Performers (same as top-performers route, limit 4, current year) ---
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);
    const employees = await prisma.employee.findMany({
      select: { id: true, city: true, user: { select: { name: true } } },
    });
    const employeeIds = employees.map(e => e.id);
    const topSales = await prisma.sale.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startOfYear, lt: endOfYear },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 4,
    });
    const performers = await Promise.all(
      topSales.map(async (sale) => {
        const employee = employees.find(e => e.id === sale.employeeId);
        const productSales = await prisma.sale.groupBy({
          by: ['productId'],
          where: {
            employeeId: sale.employeeId,
            date: { gte: startOfYear, lt: endOfYear },
          },
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 3,
        });
        let topProducts = [];
        for (const ps of productSales) {
          const product = await prisma.product.findUnique({ where: { id: ps.productId } });
          if (product) {
            topProducts.push({ name: product.name, amount: ps._sum.amount || 0 });
          }
        }
        return {
          name: employee?.user.name,
          city: employee?.city || '',
          sales: sale._sum.amount || 0,
          topProducts,
        };
      })
    );

    // --- Fetch Today's Attendance (same as dashboard/attendance/today route) ---
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const allEmployees = await prisma.employee.findMany({ include: { user: true } });
    const attendanceRecords = await prisma.attendance.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { employee: { include: { user: true } } },
    });
    const attendanceMap = new Map();
    for (const record of attendanceRecords) {
      attendanceMap.set(record.employeeId, record);
    }
    const attendance = allEmployees.map((emp) => {
      const attendance = attendanceMap.get(emp.id);
      let status = "Absent";
      let checkInTime = "-";
      if (attendance && attendance.checkIn && attendance.checkOut) {
        status = "Present";
        checkInTime = new Date(attendance.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return {
        name: emp.user?.name || "",
        city: emp.city,
        checkInTime,
        status,
      };
    });

    // --- Build HTML for PDF ---
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { color: #4f46e5; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background: #f3f4f6; }
            .section { margin-bottom: 32px; }
            .top-products { font-size: 12px; color: #6366f1; }
          </style>
        </head>
        <body>
          <h1>EMS Dashboard Report</h1>
          ${chartImage ? `<div class="section"><h2>Products Sold by City</h2><img src="${chartImage}" style="width:100%;max-width:700px;" /></div>` : ""}
          ${attendanceChartImage ? `<div class="section"><h2>Attendance Overview</h2><img src="${attendanceChartImage}" style="width:100%;max-width:700px;" /></div>` : ""}
          <div class="section">
            <h2>Stats</h2>
            <table>
              <tr>${Object.keys(stats).map(k => `<th>${k}</th>`).join("")}</tr>
              <tr>${Object.values(stats).map(v => `<td>${v}</td>`).join("")}</tr>
            </table>
          </div>
          <div class="section">
            <h2>Top Performers</h2>
            <table>
              <tr><th>Name</th><th>City</th><th>Sales</th><th>Top Products</th></tr>
              ${performers.map((p) => `<tr><td>${p.name}</td><td>${p.city}</td><td>${p.sales}</td><td class='top-products'>${p.topProducts.map(tp => `${tp.name} ($${tp.amount})`).join(", ")}</td></tr>`).join("")}
            </table>
          </div>
          <div class="section">
            <h2>Today's Attendance</h2>
            <table>
              <tr><th>Name</th><th>City</th><th>Check In</th><th>Status</th></tr>
              ${attendance.map(a => `<tr><td>${a.name}</td><td>${a.city}</td><td>${a.checkInTime}</td><td>${a.status}</td></tr>`).join("")}
            </table>
          </div>
        </body>
      </html>
    `;

    // --- Generate PDF with Puppeteer ---
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4" });
    await browser.close();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=dashboard-report.pdf"
      }
    });
  } catch (error) {
    console.error("Export Dashboard Error:", error);
    return new NextResponse("Failed to generate PDF report", { status: 500 });
  }
} 