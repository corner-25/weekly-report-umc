import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/secretary-applications/[id]/advance
// action: "INTERVIEW" | "ACCEPTED" | "REJECTED"
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { action, interviewDate, interviewScore, interviewNotes, departmentId, startDate, rejectionNotes } = body;

    const application = await prisma.secretaryApplication.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!application) return NextResponse.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 });

    if (application.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'Hồ sơ đã được nhận việc' }, { status: 400 });
    }

    // SCREENING → INTERVIEW
    if (action === 'INTERVIEW') {
      const updated = await prisma.secretaryApplication.update({
        where: { id: params.id },
        data: {
          status: 'INTERVIEW',
          interviewDate: interviewDate ? new Date(interviewDate) : null,
          interviewScore: interviewScore != null && interviewScore !== '' ? parseFloat(interviewScore) : null,
          interviewNotes: interviewNotes?.trim() || null,
        },
        include: { appliedType: true, desiredDepartment: true },
      });
      return NextResponse.json(updated);
    }

    // → REJECTED
    if (action === 'REJECTED') {
      const updated = await prisma.secretaryApplication.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          notes: rejectionNotes
            ? (application.notes ? application.notes + '\n[Từ chối] ' + rejectionNotes : '[Từ chối] ' + rejectionNotes)
            : application.notes,
        },
        include: { appliedType: true, desiredDepartment: true },
      });
      return NextResponse.json(updated);
    }

    // INTERVIEW → ACCEPTED → tạo Secretary
    if (action === 'ACCEPTED') {
      const actualDeptId = departmentId || application.desiredDepartmentId;

      const secretary = await prisma.secretary.create({
        data: {
          fullName: application.fullName,
          dateOfBirth: application.dateOfBirth,
          phone: application.phone,
          email: application.email,
          secretaryTypeId: application.appliedTypeId,
          currentDepartmentId: actualDeptId || null,
          status: 'ACTIVE',
          startDate: startDate ? new Date(startDate) : new Date(),
          notes: application.notes,
        },
      });

      // Tạo transfer log ban đầu nếu có phòng ban
      if (actualDeptId) {
        await prisma.secretaryTransferLog.create({
          data: {
            secretaryId: secretary.id,
            toDepartmentId: actualDeptId,
            transferDate: startDate ? new Date(startDate) : new Date(),
            reason: 'Phân công ban đầu',
          },
        });
      }

      // Cập nhật application
      const updated = await prisma.secretaryApplication.update({
        where: { id: params.id },
        data: { status: 'ACCEPTED', convertedSecretaryId: secretary.id },
        include: {
          appliedType: true,
          desiredDepartment: true,
          convertedSecretary: { select: { id: true, fullName: true } },
        },
      });

      return NextResponse.json({ application: updated, secretary });
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    console.error('Error advancing application:', error);
    return NextResponse.json({ error: 'Failed to advance application' }, { status: 500 });
  }
}
