import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const departmentId = searchParams.get('departmentId') || '';
    const status = searchParams.get('status') || '';

    const today = new Date();
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + 90);

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { issuedBy: { contains: search, mode: 'insensitive' } },
        { scope: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;
    if (departmentId) where.departmentId = departmentId;

    if (status === 'EXPIRED') {
      where.expiryDate = { lt: today };
    } else if (status === 'EXPIRING_SOON') {
      where.expiryDate = { gte: today, lt: threshold };
    } else if (status === 'ACTIVE') {
      where.OR = [
        { expiryDate: { gte: threshold } },
        { expiryDate: null },
      ];
      if (search) {
        // merge search OR with status OR carefully
        where.AND = [
          {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { licenseNumber: { contains: search, mode: 'insensitive' } },
              { issuedBy: { contains: search, mode: 'insensitive' } },
              { scope: { contains: search, mode: 'insensitive' } },
            ],
          },
          {
            OR: [
              { expiryDate: { gte: threshold } },
              { expiryDate: null },
            ],
          },
        ];
        delete where.OR;
      }
    }

    const licenses = await prisma.license.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { renewals: true } },
      },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(licenses);
  } catch (error) {
    console.error('Error fetching licenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, licenseNumber, category, issuedBy, issuedDate,
      expiryDate, scope, fileUrl, notes, departmentId,
    } = body;

    if (!name || !category) {
      return NextResponse.json({ error: 'name và category là bắt buộc' }, { status: 400 });
    }

    const license = await prisma.license.create({
      data: {
        name,
        licenseNumber: licenseNumber || null,
        category,
        issuedBy: issuedBy || null,
        issuedDate: issuedDate ? new Date(issuedDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        scope: scope || null,
        fileUrl: fileUrl || null,
        notes: notes || null,
        departmentId: departmentId || null,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(license, { status: 201 });
  } catch (error) {
    console.error('Error creating license:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
