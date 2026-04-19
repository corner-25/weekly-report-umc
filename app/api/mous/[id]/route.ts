import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { CACHE_TAGS } from '@/lib/cache';

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
        clauses: {
          orderBy: { orderNumber: 'asc' },
          include: {
            clauseProgress: { orderBy: { date: 'desc' }, take: 5 },
            _count: { select: { clauseProgress: true } },
          },
        },
        progressLogs: { orderBy: { date: 'desc' } },
        activities: { orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }] },
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { activities: true, documents: true, clauses: true } },
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

    // Check duplicate mouNumber (non-empty, not soft-deleted, not self)
    if (body.mouNumber?.trim()) {
      const dup = await prisma.mOU.findFirst({
        where: { mouNumber: body.mouNumber.trim(), deletedAt: null, NOT: { id } },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json({ error: 'Số hiệu MOU đã tồn tại' }, { status: 409 });
      }
    }

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

    revalidateTag(CACHE_TAGS.mouStats);
    revalidateTag(CACHE_TAGS.dashboardStats);

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

    revalidateTag(CACHE_TAGS.mouStats);
    revalidateTag(CACHE_TAGS.dashboardStats);

    return NextResponse.json({ message: 'Đã xóa MOU' });
  } catch (error) {
    console.error('Error deleting MOU:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
