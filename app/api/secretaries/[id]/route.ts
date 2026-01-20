import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Lấy chi tiết thư ký
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const secretary = await prisma.secretary.findUnique({
      where: { id },
      include: {
        secretaryType: true,
        currentDepartment: true,
        certificates: {
          orderBy: { issuedYear: 'desc' }
        },
        transferLogs: {
          include: {
            fromDepartment: true,
            toDepartment: true,
          },
          orderBy: { transferDate: 'desc' }
        }
      }
    });

    if (!secretary || secretary.deletedAt) {
      return NextResponse.json(
        { error: 'Không tìm thấy thư ký' },
        { status: 404 }
      );
    }

    return NextResponse.json(secretary);
  } catch (error) {
    console.error('Error fetching secretary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch secretary' },
      { status: 500 }
    );
  }
}

// PUT - Cập nhật thư ký
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      fullName,
      dateOfBirth,
      phone,
      email,
      avatar,
      secretaryTypeId,
      currentDepartmentId,
      status,
      startDate,
      notes,
    } = body;

    if (!fullName || fullName.trim() === '') {
      return NextResponse.json(
        { error: 'Họ và tên không được để trống' },
        { status: 400 }
      );
    }

    // Get current secretary to check department change
    const currentSecretary = await prisma.secretary.findUnique({
      where: { id },
      select: { currentDepartmentId: true }
    });

    if (!currentSecretary) {
      return NextResponse.json(
        { error: 'Không tìm thấy thư ký' },
        { status: 404 }
      );
    }

    const updatedSecretary = await prisma.secretary.update({
      where: { id },
      data: {
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        avatar: avatar || null,
        secretaryTypeId: secretaryTypeId || null,
        currentDepartmentId: currentDepartmentId || null,
        status: status || 'ACTIVE',
        startDate: startDate ? new Date(startDate) : null,
        notes: notes?.trim() || null,
      },
      include: {
        secretaryType: true,
        currentDepartment: true,
        certificates: true,
      }
    });

    return NextResponse.json(updatedSecretary);
  } catch (error) {
    console.error('Error updating secretary:', error);
    return NextResponse.json(
      { error: 'Failed to update secretary' },
      { status: 500 }
    );
  }
}

// DELETE - Xóa thư ký (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.secretary.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting secretary:', error);
    return NextResponse.json(
      { error: 'Failed to delete secretary' },
      { status: 500 }
    );
  }
}
