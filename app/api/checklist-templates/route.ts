import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET - Get all active templates
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.checklistTemplate.findMany({
      where: { isActive: true },
      orderBy: { orderNumber: 'asc' }
    });

    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
