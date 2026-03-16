import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const license = await prisma.license.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: { select: { id: true, name: true } },
        renewals: { orderBy: { renewedDate: 'desc' } },
      },
    });

    if (!license) {
      return NextResponse.json({ error: 'Không tìm thấy giấy phép' }, { status: 404 });
    }

    return NextResponse.json(license);
  } catch (error) {
    console.error('Error fetching license:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name, licenseNumber, category, issuedBy, issuedDate,
      expiryDate, scope, fileUrl, notes, departmentId,
    } = body;

    const license = await prisma.license.update({
      where: { id },
      data: {
        name,
        licenseNumber: licenseNumber || null,
        category,
        issuedBy: issuedBy || null,
        issuedDate: issuedDate ? new Date(issuedDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        scope: scope || null,
        fileUrl: fileUrl || null,
        notes: notes || null,
        departmentId: departmentId || null,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(license);
  } catch (error) {
    console.error('Error updating license:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.license.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting license:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
