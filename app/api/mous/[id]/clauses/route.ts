import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST - Add clause to MOU
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

    if (!body.title) {
      return NextResponse.json({ error: 'Thiếu tiêu đề điều khoản' }, { status: 400 });
    }

    // Get next order number
    const maxOrder = await prisma.mOUClause.aggregate({
      where: { mouId: id },
      _max: { orderNumber: true },
    });

    const clause = await prisma.mOUClause.create({
      data: {
        mouId: id,
        orderNumber: (maxOrder._max.orderNumber ?? 0) + 1,
        title: body.title,
        content: body.content || null,
        responsible: body.responsible || null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        progress: body.progress ?? 0,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(clause, { status: 201 });
  } catch (error) {
    console.error('Error creating clause:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// PUT - Update clause (pass clauseId in body)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.clauseId) {
      return NextResponse.json({ error: 'Thiếu clauseId' }, { status: 400 });
    }

    const clause = await prisma.mOUClause.update({
      where: { id: body.clauseId },
      data: {
        title: body.title ?? undefined,
        content: body.content ?? undefined,
        responsible: body.responsible ?? undefined,
        deadline: body.deadline ? new Date(body.deadline) : body.deadline === null ? null : undefined,
        progress: body.progress ?? undefined,
        isCompleted: body.isCompleted ?? undefined,
        completedAt: body.isCompleted ? new Date() : body.isCompleted === false ? null : undefined,
        notes: body.notes ?? undefined,
      },
    });

    return NextResponse.json(clause);
  } catch (error) {
    console.error('Error updating clause:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// DELETE - Delete clause (clauseId in query)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clauseId = searchParams.get('clauseId');

    if (!clauseId) {
      return NextResponse.json({ error: 'Thiếu clauseId' }, { status: 400 });
    }

    await prisma.mOUClause.delete({ where: { id: clauseId } });

    return NextResponse.json({ message: 'Đã xóa điều khoản' });
  } catch (error) {
    console.error('Error deleting clause:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
