import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST - Add progress log to MOU
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.content) {
      return NextResponse.json({ error: 'Thiếu nội dung cập nhật' }, { status: 400 });
    }

    const progress = await prisma.mOUProgress.create({
      data: {
        mouId: id,
        date: body.date ? new Date(body.date) : new Date(),
        content: body.content,
        achievement: body.achievement || null,
        issues: body.issues || null,
        nextSteps: body.nextSteps || null,
        updatedBy: session.user?.name || session.user?.email || null,
      },
    });

    return NextResponse.json(progress, { status: 201 });
  } catch (error) {
    console.error('Error creating progress:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
