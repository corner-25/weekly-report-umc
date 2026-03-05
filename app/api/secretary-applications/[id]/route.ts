import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const application = await prisma.secretaryApplication.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        appliedType: true,
        desiredDepartment: true,
        convertedSecretary: { select: { id: true, fullName: true, currentDepartment: true } },
      },
    });
    if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const {
      fullName, dateOfBirth, phone, email, cvUrl,
      appliedTypeId, desiredDepartmentId, source,
      interviewDate, interviewScore, interviewNotes, notes,
    } = body;

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Họ và tên không được để trống' }, { status: 400 });
    }

    const application = await prisma.secretaryApplication.update({
      where: { id: params.id },
      data: {
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        cvUrl: cvUrl?.trim() || null,
        appliedTypeId: appliedTypeId || null,
        desiredDepartmentId: desiredDepartmentId || null,
        source: source?.trim() || null,
        interviewDate: interviewDate ? new Date(interviewDate) : null,
        interviewScore: interviewScore !== '' && interviewScore != null ? parseFloat(interviewScore) : null,
        interviewNotes: interviewNotes?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: { appliedType: true, desiredDepartment: true },
    });

    return NextResponse.json(application);
  } catch (error) {
    console.error('Error updating application:', error);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.secretaryApplication.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting application:', error);
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 });
  }
}
