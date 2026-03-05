import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const hospitalEventSchema = z.object({
  name: z.string().min(1, "Tên sự kiện là bắt buộc"),
  date: z.string().datetime(),
  time: z.string().optional(),
  description: z.string().optional(),
  meetingRoomId: z.string().optional(),
  eventType: z.enum(['ORGANIZED', 'COLLABORATED']).default('ORGANIZED'),
  chair: z.string().optional(),
  participants: z.string().optional(),
  note: z.string().optional(),
  status: z.enum(['CONFIRMED', 'UNCONFIRMED']).default('UNCONFIRMED'),
});

// GET - List events with filters
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = searchParams.get('eventType');
    const meetingRoomId = searchParams.get('meetingRoomId');
    const status = searchParams.get('status');

    const events = await prisma.hospitalEvent.findMany({
      where: {
        deletedAt: null,
        ...(startDate && endDate && {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }),
        ...(eventType && { eventType: eventType as any }),
        ...(meetingRoomId && { meetingRoomId }),
        ...(status && { status: status as any }),
      },
      include: {
        meetingRoom: true,
        checklistItems: {
          orderBy: { orderNumber: 'asc' }
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST - Create event with auto-checklist
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = hospitalEventSchema.parse(body);

    // 1. Create event
    const event = await prisma.hospitalEvent.create({
      data: {
        ...data,
        date: new Date(data.date),
      }
    });

    // 2. Get default checklist templates
    const templates = await prisma.checklistTemplate.findMany({
      where: { isDefault: true, isActive: true },
      orderBy: { orderNumber: 'asc' }
    });

    // 3. Create checklist items from templates
    if (templates.length > 0) {
      await prisma.eventChecklistItem.createMany({
        data: templates.map((t) => ({
          hospitalEventId: event.id,
          title: t.title,
          description: t.description,
          orderNumber: t.orderNumber,
          isCompleted: false,
        }))
      });
    }

    // 4. Return event with relations
    const fullEvent = await prisma.hospitalEvent.findUnique({
      where: { id: event.id },
      include: {
        meetingRoom: true,
        checklistItems: {
          orderBy: { orderNumber: 'asc' }
        }
      }
    });

    return NextResponse.json(fullEvent, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
