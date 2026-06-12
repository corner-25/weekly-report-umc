import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { VehicleCategory, VehicleStatus } from '@prisma/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: {
        license: { select: { id: true, name: true, licenseNumber: true, expiryDate: true, fileUrl: true } },
        maintenanceLogs: { orderBy: { date: 'desc' } },
      },
    });
    if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Also pull related Licenses by license plate (đèn còi, kiểm định...)
    // so the detail page can show every paper that mentions this plate.
    // Try multiple plate formats: 50A-007-20, 50A-007.20, 50A 007 20.
    const plateRaw = vehicle.licensePlate.replace(/\s+/g, '').toUpperCase();
    const platePatterns = [
      plateRaw,
      plateRaw.replace(/-/g, '.'),
      plateRaw.replace(/\./g, '-'),
    ];
    const relatedLicenses = await prisma.license.findMany({
      where: {
        OR: platePatterns.map((p) => ({ name: { contains: p, mode: 'insensitive' as const } })),
      },
      select: { id: true, name: true, licenseNumber: true, category: true, expiryDate: true, issuedDate: true, scope: true, fileUrl: true },
    });

    return NextResponse.json({ ...vehicle, relatedLicenses });
  } catch (e) {
    console.error('Error fetching vehicle', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        licensePlate: body.licensePlate?.trim() || undefined,
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
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
