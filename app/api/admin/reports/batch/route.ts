import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit } from '@/lib/rate-limit';
import { notifyUserOrEmployee } from '@/lib/notifications';

// Rate limit configuration
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

// Maximum number of reports that can be processed in a single batch
const MAX_BATCH_SIZE = 50;

export async function PATCH(req: NextRequest) {
  // Check authentication and admin status
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    // Rate limiting
    try {
      await limiter.check(5, 'BATCH_REPORT_API'); // 5 batch requests per minute
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { reportIds, action, rejectionReason } = body;

    // Validate request body
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json(
        { error: 'reportIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (reportIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Cannot process more than ${MAX_BATCH_SIZE} reports at once` },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be either "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json(
        { error: 'rejectionReason is required when action is "reject"' },
        { status: 400 }
      );
    }

    // Process reports in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const processedResults = [];

      for (const reportId of reportIds) {
        try {
          // Check if report exists and is in pending state
          const report = await tx.report.findUnique({
            where: { id: reportId },
            include: {
              employee: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          });

          if (!report) {
            processedResults.push({
              reportId,
              success: false,
              error: 'Report not found'
            });
            continue;
          }

          if (report.status !== 'pending') {
            processedResults.push({
              reportId,
              success: false,
              error: 'Report is not in pending state'
            });
            continue;
          }

          // Notify employee and admin before update
          try {
            const now = new Date().toLocaleString();
            const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
            if (action === 'approve') {
              await notifyUserOrEmployee({
                employeeId: report.employee.id,
                type: 'employee_report_approved',
                message: `Admin approved your report on ${now}.`,
                actionUrl: '/employee/reports',
                actionLabel: 'View Reports',
                sessionToken,
                broadcastToEmployee: true,
              });
              await notifyUserOrEmployee({
                userId: auth.session?.user?.id,
                type: 'admin_report_approved',
                message: `You approved a report for employee ${report.employee.user?.name || report.employee.user?.email} on ${now}.`,
                actionUrl: `/admin/employees/${report.employee.id}/details`,
                actionLabel: 'View Employee',
                sessionToken,
                broadcastToAdmin: true,
              });
            } else if (action === 'reject') {
              await notifyUserOrEmployee({
                employeeId: report.employee.id,
                type: 'employee_report_rejected',
                message: `Admin rejected your report on ${now}.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`,
                actionUrl: '/employee/reports',
                actionLabel: 'View Reports',
                sessionToken,
                broadcastToEmployee: true,
              });
              await notifyUserOrEmployee({
                userId: auth.session?.user?.id,
                type: 'admin_report_rejected',
                message: `You rejected a report for employee ${report.employee.user?.name || report.employee.user?.email} on ${now}.`,
                actionUrl: `/admin/employees/${report.employee.id}/details`,
                actionLabel: 'View Employee',
                sessionToken,
                broadcastToAdmin: true,
              });
            }
          } catch (notifyErr) {
            console.error('[Notification] Failed to notify for report bulk action:', notifyErr);
          }

          // Update report status
          const updatedReport = await tx.report.update({
            where: { id: reportId },
            data: {
              status: action === 'approve' ? 'approved' : 'rejected',
              rejectionReason: action === 'reject' ? rejectionReason : null
            }
          });

          processedResults.push({
            reportId,
            success: true,
            status: updatedReport.status
          });
        } catch (error) {
          processedResults.push({
            reportId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return processedResults;
    });

    // Calculate success/failure counts
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} reports: ${successCount} succeeded, ${failureCount} failed`,
      results
    });
  } catch (error) {
    console.error('Error processing batch reports:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process batch reports', 
        details: error instanceof Error ? error.message : 'Unknown error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  // Check authentication and admin status
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    // Rate limiting
    try {
      await limiter.check(5, 'BATCH_DELETE_API'); // 5 batch delete requests per minute
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { reportIds } = body;

    // Validate request body
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json(
        { error: 'reportIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (reportIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Cannot delete more than ${MAX_BATCH_SIZE} reports at once` },
        { status: 400 }
      );
    }

    // Process deletions in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const processedResults = [];

      for (const reportId of reportIds) {
        try {
          // Check if report exists
          const report = await tx.report.findUnique({
            where: { id: reportId },
            include: {
              employee: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          });

          if (!report) {
            processedResults.push({
              reportId,
              success: false,
              error: 'Report not found'
            });
            continue;
          }

          // Notify employee and admin before delete
          try {
            const now = new Date().toLocaleString();
            const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
            await notifyUserOrEmployee({
              employeeId: report.employee.id,
              type: 'employee_report_deleted',
              message: `Admin deleted your report on ${now}.`,
              actionUrl: '/employee/reports',
              actionLabel: 'View Reports',
              sessionToken,
              broadcastToEmployee: true,
            });
            await notifyUserOrEmployee({
              userId: auth.session?.user?.id,
              type: 'admin_report_deleted',
              message: `You deleted a report for employee ${report.employee.user?.name || report.employee.user?.email} on ${now}.`,
              actionUrl: `/admin/employees/${report.employee.id}/details`,
              actionLabel: 'View Employee',
              sessionToken,
              broadcastToAdmin: true,
            });
          } catch (notifyErr) {
            console.error('[Notification] Failed to notify for report bulk delete:', notifyErr);
          }

          // Delete report
          await tx.report.delete({
            where: { id: reportId }
          });

          processedResults.push({
            reportId,
            success: true
          });
        } catch (error) {
          processedResults.push({
            reportId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return processedResults;
    });

    // Calculate success/failure counts
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.length} reports: ${successCount} succeeded, ${failureCount} failed`,
      results
    });
  } catch (error) {
    console.error('Error deleting batch reports:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete batch reports', 
        details: error instanceof Error ? error.message : 'Unknown error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
} 