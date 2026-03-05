import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Cập nhật bằng cấp
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, issuedYear, issuedBy, attachmentUrl, notes } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Tên bằng cấp không được để trống' },
        { status: 400 }
      );
    }

    const certificate = await prisma.secretaryCertificate.update({
      where: { id },
      data: {
        name: name.trim(),
        issuedYear: issuedYear ? parseInt(issuedYear) : null,
        issuedBy: issuedBy?.trim() || null,
        attachmentUrl: attachmentUrl || null,
        notes: notes?.trim() || null,
      }
    });

    return NextResponse.json(certificate);
  } catch (error) {
    console.error('Error updating certificate:', error);
    return NextResponse.json(
      { error: 'Failed to update certificate' },
      { status: 500 }
    );
  }
}

// DELETE - Xóa bằng cấp
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.secretaryCertificate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    return NextResponse.json(
      { error: 'Failed to delete certificate' },
      { status: 500 }
    );
  }
}
