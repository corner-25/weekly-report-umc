import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { CACHE_TAGS } from '@/lib/cache';

// GET - Lấy chi tiết loại thư ký
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const type = await prisma.secretaryType.findUnique({
      where: { id },
      include: {
        secretaries: {
          where: { deletedAt: null },
          select: { id: true, fullName: true }
        }
      }
    });

    if (!type) {
      return NextResponse.json(
        { error: 'Không tìm thấy loại thư ký' },
        { status: 404 }
      );
    }

    return NextResponse.json(type);
  } catch (error) {
    console.error('Error fetching secretary type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch secretary type' },
      { status: 500 }
    );
  }
}

// PUT - Cập nhật loại thư ký
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color, isActive } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Tên loại thư ký không được để trống' },
        { status: 400 }
      );
    }

    // Check if name exists for another type
    const existingType = await prisma.secretaryType.findFirst({
      where: {
        name: name.trim(),
        NOT: { id }
      }
    });

    if (existingType) {
      return NextResponse.json(
        { error: 'Loại thư ký này đã tồn tại' },
        { status: 400 }
      );
    }

    const updatedType = await prisma.secretaryType.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
        isActive: isActive ?? true,
      }
    });

    revalidateTag(CACHE_TAGS.secretaryTypes);
    return NextResponse.json(updatedType);
  } catch (error) {
    console.error('Error updating secretary type:', error);
    return NextResponse.json(
      { error: 'Failed to update secretary type' },
      { status: 500 }
    );
  }
}

// DELETE - Xóa loại thư ký (soft delete bằng isActive)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if type has secretaries
    const typeWithSecretaries = await prisma.secretaryType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { secretaries: true }
        }
      }
    });

    if (!typeWithSecretaries) {
      return NextResponse.json(
        { error: 'Không tìm thấy loại thư ký' },
        { status: 404 }
      );
    }

    if (typeWithSecretaries._count.secretaries > 0) {
      return NextResponse.json(
        { error: 'Không thể xóa loại thư ký đang có thư ký sử dụng' },
        { status: 400 }
      );
    }

    await prisma.secretaryType.update({
      where: { id },
      data: { isActive: false }
    });

    revalidateTag(CACHE_TAGS.secretaryTypes);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting secretary type:', error);
    return NextResponse.json(
      { error: 'Failed to delete secretary type' },
      { status: 500 }
    );
  }
}
