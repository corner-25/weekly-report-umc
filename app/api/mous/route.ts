import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET - List MOUs with filters
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const departmentId = searchParams.get('departmentId');

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { partnerName: { contains: search, mode: 'insensitive' } },
        { mouNumber: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;
    if (departmentId) where.departmentId = departmentId;

    // Status filter with date-based logic
    if (status) {
      const today = new Date();
      const soon = new Date();
      soon.setDate(soon.getDate() + 90);

      switch (status) {
        case 'ACTIVE':
          where.status = 'ACTIVE';
          where.OR = [
            { expiryDate: null },
            { expiryDate: { gt: soon } },
          ];
          break;
        case 'EXPIRING':
          where.status = 'ACTIVE';
          where.expiryDate = { lte: soon, gt: today };
          break;
        case 'EXPIRED':
          where.status = { in: ['EXPIRED', 'ACTIVE'] };
          where.expiryDate = { lte: today };
          break;
        case 'DRAFT':
          where.status = 'DRAFT';
          break;
        case 'TERMINATED':
          where.status = 'TERMINATED';
          break;
      }
    }

    const mous = await prisma.mOU.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { clauses: true, progressLogs: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(mous, {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
      },
    });
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

    const mou = await prisma.mOU.create({
      data: {
        title: body.title,
        mouNumber: body.mouNumber || null,
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

    return NextResponse.json(mou, { status: 201 });
  } catch (error) {
    console.error('Error creating MOU:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
