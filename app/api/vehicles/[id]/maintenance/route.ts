import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const logs = await prisma.vehicleMaintenance.findMany({
      where: { vehicleId: id },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(logs);
  } catch (e) {
    console.error('Error fetching maintenance logs', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    if (!body.description?.trim()) {
      return NextResponse.json({ error: 'Mô tả không được để trống' }, { status: 400 });
    }
    const created = await prisma.vehicleMaintenance.create({
      data: {
        vehicleId: id,
        date: body.date ? new Date(body.date) : null,
        odometer: body.odometer ? parseInt(body.odometer, 10) : null,
        category: body.category?.trim() || null,
        description: body.description.trim(),
        workshop: body.workshop?.trim() || null,
        costAmount: body.costAmount ? Number(body.costAmount) : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('Error creating maintenance log', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
