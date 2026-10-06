import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { normalizePlate } from '@/lib/fleet/plate';
import { Prisma, type VehicleCategory, type VehicleStatus } from '@prisma/client';

/** Cửa sổ đếm số chuyến gần đây của từng xe. */
const TRIP_WINDOW_DAYS = 30;

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
        registrationNumber: true, expiryYear: true, fuelType: true,
      },
      orderBy: [{ category: 'asc' }, { licensePlate: 'asc' }],
    });
    // Hoạt động 30 ngày qua của từng xe (từ nhật ký chuyến tài xế nhập) — số chuyến, lần chạy gần nhất, công-tơ-mét.
    const since = new Date(Date.now() - TRIP_WINDOW_DAYS * 86_400_000);
    const ids = vehicles.map((v) => v.id);
    const [recent, latest] = await Promise.all([
      prisma.fleetTrip.groupBy({ by: ['vehicleRefId'], where: { vehicleRefId: { in: ids }, recordDate: { gte: since } }, _count: { _all: true } }),
      prisma.fleetTrip.groupBy({ by: ['vehicleRefId'], where: { vehicleRefId: { in: ids } }, _max: { recordDate: true, odometer: true } }),
    ]);
    const tripsOf = new Map(recent.map((r) => [r.vehicleRefId, r._count._all]));
    const lastOf = new Map(latest.map((r) => [r.vehicleRefId, r._max]));
    return NextResponse.json(
      vehicles.map((v) => ({
        ...v,
        trips30: tripsOf.get(v.id) ?? 0,
        lastTripAt: lastOf.get(v.id)?.recordDate?.toISOString() ?? null,
        odometer: lastOf.get(v.id)?.odometer ?? null,
      })),
    );
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
