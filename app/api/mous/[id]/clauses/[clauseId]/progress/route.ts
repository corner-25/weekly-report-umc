import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET - List progress logs for a clause
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const { clauseId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logs = await prisma.clauseProgress.findMany({
      where: { clauseId },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching clause progress:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST - Add progress log to a clause
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const { clauseId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.content) {
      return NextResponse.json({ error: 'Thiếu nội dung cập nhật' }, { status: 400 });
    }

    // Get current clause progress for progressBefore
    const clause = await prisma.mOUClause.findUnique({
      where: { id: clauseId },
      select: { progress: true },
    });

    const progressBefore = clause?.progress ?? 0;
    const progressAfter = body.progressAfter ?? progressBefore;

    // Create progress log
    const log = await prisma.clauseProgress.create({
      data: {
        clauseId,
        date: body.date ? new Date(body.date) : new Date(),
        content: body.content,
        achievement: body.achievement || null,
        issues: body.issues || null,
        nextSteps: body.nextSteps || null,
        progressBefore,
        progressAfter,
        updatedBy: session.user?.name || session.user?.email || null,
      },
    });

    // Update clause progress if progressAfter is provided
    if (body.progressAfter !== undefined) {
      await prisma.mOUClause.update({
        where: { id: clauseId },
        data: {
          progress: progressAfter,
          clauseStatus: progressAfter >= 100 ? 'COMPLETED' : progressAfter > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
          isCompleted: progressAfter >= 100,
          completedAt: progressAfter >= 100 ? new Date() : null,
        },
      });
    }

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Error creating clause progress:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
