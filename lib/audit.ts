import { prisma } from './prisma'

export const auditLog = async (action: string, userId: string, details?: Record<string, any>) => {
  try {
    // Get employee ID from user ID
    const employee = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true }
    })

    if (employee) {
      await prisma.report.create({
        data: {
          employeeId: employee.id,
          type: 'audit',
          details: {
            action,
            ...details
          },
          status: 'completed'
        }
      })
    }
  } catch (error) {
    console.error('Audit log error:', error)
  }
} 