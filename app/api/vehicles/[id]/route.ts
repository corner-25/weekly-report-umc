import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { normalizePlate } from '@/lib/fleet/plate';
import { Prisma, type VehicleCategory, type VehicleStatus } from '@prisma/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: {
        // Giấy tờ nay nối thẳng qua vehicleId. Trước đây phải dò tên giấy phép
        // theo ba biến thể cách viết biển số vì hai bảng không có quan hệ nào.
        licenses: {
          select: {
            id: true,
            name: true,
            licenseNumber: true,
            category: true,
            expiryDate: true,
            issuedDate: true,
            scope: true,
            fileUrl: true,
          },
          orderBy: { expiryDate: 'asc' },
        },
        maintenanceLogs: { orderBy: { date: 'desc' } },
      },
    });
    if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // `relatedLicenses` giữ tên cũ để trang chi tiết không phải sửa.
    return NextResponse.json({ ...vehicle, relatedLicenses: vehicle.licenses });
  } catch (e) {
    console.error('Error fetching vehicle', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const licensePlate = body.licensePlate?.trim();
    const licensePlateNormalized = licensePlate ? normalizePlate(licensePlate) : undefined;
    if (licensePlate && !licensePlateNormalized) {
      return NextResponse.json({ error: 'Biển số phải chứa chữ hoặc số' }, { status: 400 });
    }
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        licensePlate: licensePlate || undefined,
        licensePlateNormalized,
        brand: body.brand?.trim() ?? null,
        model: body.model?.trim() ?? null,
        category: body.category as VehicleCategory | undefined,
        color: body.color?.trim() ?? null,
        engineNumber: body.engineNumber?.trim() ?? null,
        chassisNumber: body.chassisNumber?.trim() ?? null,
        seatCount: body.seatCount?.trim() ?? null,
        manufactureYear: body.manufactureYear ? parseInt(body.manufactureYear, 10) : null,
        manufactureCountry: body.manufactureCountry?.trim() ?? null,
        ownerName: body.ownerName?.trim() ?? null,
        ownerAddress: body.ownerAddress?.trim() ?? null,
        manager: body.manager?.trim() ?? null,
        status: body.status as VehicleStatus | undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('Error updating vehicle', e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Biển số đã tồn tại trong hệ thống' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Error deleting vehicle', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
