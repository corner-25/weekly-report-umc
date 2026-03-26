import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET - List activities for a MOU
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const activities = await prisma.mOUActivity.findMany({
      where: { mouId: id },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching MOU activities:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST - Create new activity
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: 'Tên hoạt động là bắt buộc' }, { status: 400 });
    }

    const activity = await prisma.mOUActivity.create({
      data: {
        mouId: id,
        title: body.title,
        description: body.description || null,
        activityType: body.activityType || null,
        status: body.status || 'PLANNED',
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        location: body.location || null,
        participants: body.participants || null,
        responsible: body.responsible || null,
        budget: body.budget || null,
        result: body.result || null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Error creating MOU activity:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
