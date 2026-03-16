import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCachedSecretaryTypes, CACHE_TAGS } from '@/lib/cache';

// GET - Lấy danh sách loại thư ký
export async function GET() {
  try {
    const types = await getCachedSecretaryTypes();
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

    revalidateTag(CACHE_TAGS.secretaryTypes);
    return NextResponse.json(newType, { status: 201 });
  } catch (error) {
    console.error('Error creating secretary type:', error);
    return NextResponse.json(
      { error: 'Failed to create secretary type' },
      { status: 500 }
    );
  }
}
