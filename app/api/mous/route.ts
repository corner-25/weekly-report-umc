import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { CACHE_TAGS } from '@/lib/cache';
import type { Prisma } from '@prisma/client';

type SortKey = 'updatedAt' | 'expiryDate' | 'signedDate' | 'title';

// GET - List MOUs with filters
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const departmentId = searchParams.get('departmentId');
    const sortKey = (searchParams.get('sort') || 'updatedAt') as SortKey;
    const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(searchParams.get('pageSize') || '50', 10)));

    const AND: Prisma.MOUWhereInput[] = [{ deletedAt: null }];

    if (search) {
      AND.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { partnerName: { contains: search, mode: 'insensitive' } },
          { mouNumber: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (category) AND.push({ category: category as any });
    if (departmentId) AND.push({ departmentId });

    // Status filter with date-based logic
    if (status) {
      const today = new Date();
      const soon = new Date();
      soon.setDate(soon.getDate() + 90);

      switch (status) {
        case 'ACTIVE':
          AND.push({ status: 'ACTIVE' });
          AND.push({ OR: [{ expiryDate: null }, { expiryDate: { gt: soon } }] });
          break;
        case 'EXPIRING':
          AND.push({ status: 'ACTIVE' });
          AND.push({ expiryDate: { lte: soon, gt: today } });
          break;
        case 'EXPIRED':
          AND.push({ status: { in: ['EXPIRED', 'ACTIVE'] } });
          AND.push({ expiryDate: { lte: today } });
          break;
        case 'DRAFT':
          AND.push({ status: 'DRAFT' });
          break;
        case 'TERMINATED':
          AND.push({ status: 'TERMINATED' });
          break;
      }
    }

    const where: Prisma.MOUWhereInput = { AND };

    const orderBy: Prisma.MOUOrderByWithRelationInput =
      sortKey === 'expiryDate' ? { expiryDate: { sort: sortDir, nulls: 'last' } } :
      sortKey === 'signedDate' ? { signedDate: { sort: sortDir, nulls: 'last' } } :
      sortKey === 'title' ? { title: sortDir } :
      { updatedAt: sortDir };

    const [total, mous] = await Promise.all([
      prisma.mOU.count({ where }),
      prisma.mOU.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          clauses: { select: { progress: true } },
          _count: { select: { clauses: true, progressLogs: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json(
      { items: mous, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      {
        headers: {
          'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (error) {
    console.error('Error fetching MOUs:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST - Create new MOU
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.title || !body.category || !body.partnerName) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc: tên MOU, loại, và đối tác' },
        { status: 400 }
      );
    }

    // Check duplicate mouNumber (non-empty, not soft-deleted)
    if (body.mouNumber?.trim()) {
      const dup = await prisma.mOU.findFirst({
        where: { mouNumber: body.mouNumber.trim(), deletedAt: null },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json({ error: 'Số hiệu MOU đã tồn tại' }, { status: 409 });
      }
    }

    const mou = await prisma.mOU.create({
      data: {
        title: body.title,
        mouNumber: body.mouNumber?.trim() || null,
        category: body.category,
        status: body.status || 'DRAFT',
        partnerName: body.partnerName,
        partnerCountry: body.partnerCountry || null,
        partnerContact: body.partnerContact || null,
        partnerLogo: body.partnerLogo || null,
        signedDate: body.signedDate ? new Date(body.signedDate) : null,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        autoRenew: body.autoRenew || false,
        purpose: body.purpose || null,
        scope: body.scope || null,
        keyTerms: body.keyTerms || null,
        fileUrl: body.fileUrl || null,
        notes: body.notes || null,
        departmentId: body.departmentId || null,
        contactPerson: body.contactPerson || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    revalidateTag(CACHE_TAGS.mouStats);
    revalidateTag(CACHE_TAGS.dashboardStats);

    return NextResponse.json(mou, { status: 201 });
  } catch (error) {
    console.error('Error creating MOU:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
