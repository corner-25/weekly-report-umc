import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Thêm bằng cấp cho thư ký
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secretaryId, name, issuedYear, issuedBy, attachmentUrl, notes } = body;

    if (!secretaryId) {
      return NextResponse.json(
        { error: 'secretaryId là bắt buộc' },
        { status: 400 }
      );
    }

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Tên bằng cấp không được để trống' },
        { status: 400 }
      );
    }

    const certificate = await prisma.secretaryCertificate.create({
      data: {
        secretaryId,
        name: name.trim(),
        issuedYear: issuedYear ? parseInt(issuedYear) : null,
        issuedBy: issuedBy?.trim() || null,
        attachmentUrl: attachmentUrl || null,
        notes: notes?.trim() || null,
      }
    });

    return NextResponse.json(certificate, { status: 201 });
  } catch (error) {
    console.error('Error creating certificate:', error);
    return NextResponse.json(
      { error: 'Failed to create certificate' },
      { status: 500 }
    );
  }
}
