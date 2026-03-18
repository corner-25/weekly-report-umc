import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET - Get MOU detail
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mou = await prisma.mOU.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        clauses: { orderBy: { orderNumber: 'asc' } },
        progressLogs: { orderBy: { date: 'desc' } },
      },
    });

    if (!mou || mou.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy MOU' }, { status: 404 });
    }

    return NextResponse.json(mou);
  } catch (error) {
    console.error('Error fetching MOU:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// PUT - Update MOU
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const mou = await prisma.mOU.update({
      where: { id },
      data: {
        title: body.title,
        mouNumber: body.mouNumber ?? undefined,
        category: body.category,
        status: body.status,
        partnerName: body.partnerName,
        partnerCountry: body.partnerCountry ?? undefined,
        partnerContact: body.partnerContact ?? undefined,
        partnerLogo: body.partnerLogo ?? undefined,
        signedDate: body.signedDate ? new Date(body.signedDate) : body.signedDate === null ? null : undefined,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : body.effectiveDate === null ? null : undefined,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : body.expiryDate === null ? null : undefined,
        autoRenew: body.autoRenew ?? undefined,
        purpose: body.purpose ?? undefined,
        scope: body.scope ?? undefined,
        keyTerms: body.keyTerms ?? undefined,
        fileUrl: body.fileUrl ?? undefined,
        notes: body.notes ?? undefined,
        departmentId: body.departmentId ?? undefined,
        contactPerson: body.contactPerson ?? undefined,
        contactEmail: body.contactEmail ?? undefined,
        contactPhone: body.contactPhone ?? undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        clauses: { orderBy: { orderNumber: 'asc' } },
      },
    });

    return NextResponse.json(mou);
  } catch (error) {
    console.error('Error updating MOU:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// DELETE - Soft delete MOU
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.mOU.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'Đã xóa MOU' });
  } catch (error) {
    console.error('Error deleting MOU:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
