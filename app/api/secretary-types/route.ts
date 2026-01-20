import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Lấy danh sách loại thư ký
export async function GET() {
  try {
    const types = await prisma.secretaryType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { secretaries: true }
        }
      }
    });

    return NextResponse.json(types);
  } catch (error) {
    console.error('Error fetching secretary types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch secretary types' },
      { status: 500 }
    );
  }
}

// POST - Tạo loại thư ký mới
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Tên loại thư ký không được để trống' },
        { status: 400 }
      );
    }

    const existingType = await prisma.secretaryType.findUnique({
      where: { name: name.trim() }
    });

    if (existingType) {
      return NextResponse.json(
        { error: 'Loại thư ký này đã tồn tại' },
        { status: 400 }
      );
    }

    const newType = await prisma.secretaryType.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
      }
    });

    return NextResponse.json(newType, { status: 201 });
  } catch (error) {
    console.error('Error creating secretary type:', error);
    return NextResponse.json(
      { error: 'Failed to create secretary type' },
      { status: 500 }
    );
  }
}
