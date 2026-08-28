import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { normalizePlate } from '@/lib/fleet/plate';
import { Prisma, type VehicleCategory, type VehicleStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const search = sp.get('search') || '';
    const category = sp.get('category');
    const status = sp.get('status');

    const where: Prisma.VehicleWhereInput = { deletedAt: null };
    if (search) {
      const normalizedSearch = normalizePlate(search);
      where.OR = [
        { licensePlate: { contains: search, mode: 'insensitive' } },
        ...(normalizedSearch
          ? [{ licensePlateNormalized: { contains: normalizedSearch } }]
          : []),
        { engineNumber: { contains: search, mode: 'insensitive' } },
        { chassisNumber: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category as VehicleCategory;
    if (status) where.status = status as VehicleStatus;

    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        id: true, licensePlate: true, brand: true, model: true, category: true,
        color: true, manufactureYear: true, seatCount: true, status: true,
        manager: true, inspectionExpiry: true, insuranceExpiry: true,
        registrationNumber: true,
      },
      orderBy: [{ category: 'asc' }, { licensePlate: 'asc' }],
    });
    return NextResponse.json(vehicles);
  } catch (e) {
    console.error('Error fetching vehicles', e);
    return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.licensePlate?.trim()) {
      return NextResponse.json({ error: 'Biển số không được để trống' }, { status: 400 });
    }
    const licensePlate = body.licensePlate.trim();
    const licensePlateNormalized = normalizePlate(licensePlate);
    if (!licensePlateNormalized) {
      return NextResponse.json({ error: 'Biển số phải chứa chữ hoặc số' }, { status: 400 });
    }

    const created = await prisma.vehicle.create({
      data: {
        licensePlate,
        licensePlateNormalized,
        brand: body.brand?.trim() || null,
        model: body.model?.trim() || null,
        category: (body.category as VehicleCategory) || 'OTHER',
        color: body.color?.trim() || null,
        engineNumber: body.engineNumber?.trim() || null,
        chassisNumber: body.chassisNumber?.trim() || null,
        seatCount: body.seatCount?.trim() || null,
        manufactureYear: body.manufactureYear ? parseInt(body.manufactureYear, 10) : null,
        manufactureCountry: body.manufactureCountry?.trim() || null,
        ownerName: body.ownerName?.trim() || null,
        ownerAddress: body.ownerAddress?.trim() || null,
        manager: body.manager?.trim() || null,
        status: (body.status as VehicleStatus) || 'IN_USE',
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('Error creating vehicle', e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Biển số đã tồn tại trong hệ thống' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
