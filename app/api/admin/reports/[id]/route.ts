import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from "@/lib/auth-guard";

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  // Check authentication and admin status
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    // Get the report ID from params
    const { id } = context.params;
    
    // Validate that the report exists before updating
    const existingReport = await prisma.report.findUnique({
      where: { id },
    });
    
    if (!existingReport) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }
    
    // Parse and validate the request body
    const body = await req.json();

    // Validate status value
    if (body.status && !['pending', 'approved', 'rejected'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status value. Must be "pending", "approved", or "rejected".' },
        { status: 400 }
      );
    }
    
    // Update the report
    const report = await prisma.report.update({
      where: { id },
      data: body,
    });
    
    return NextResponse.json({
      success: true,
      message: `Report status updated to ${body.status}`,
      report
    });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Failed to update report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}