import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const renewals = await prisma.licenseRenewal.findMany({
      where: { licenseId: id },
      orderBy: { renewedDate: 'desc' },
    });
    return NextResponse.json(renewals);
  } catch (error) {
    console.error('Error fetching renewals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { renewedDate, newExpiryDate, renewedBy, decisionNumber, fileUrl, notes } = body;

    if (!renewedDate) {
      return NextResponse.json({ error: 'renewedDate là bắt buộc' }, { status: 400 });
    }

    // Get current license to snapshot previousExpiry
    const license = await prisma.license.findFirst({ where: { id, deletedAt: null } });
    if (!license) {
      return NextResponse.json({ error: 'Không tìm thấy giấy phép' }, { status: 404 });
    }

    // Atomic: create renewal + update license expiryDate
    const [renewal] = await prisma.$transaction([
      prisma.licenseRenewal.create({
        data: {
          licenseId: id,
          renewedDate: new Date(renewedDate),
          newExpiryDate: newExpiryDate ? new Date(newExpiryDate) : null,
          previousExpiry: license.expiryDate,
          renewedBy: renewedBy || null,
          decisionNumber: decisionNumber || null,
          fileUrl: fileUrl || null,
          notes: notes || null,
        },
      }),
      prisma.license.update({
        where: { id },
        data: { expiryDate: newExpiryDate ? new Date(newExpiryDate) : license.expiryDate },
      }),
    ]);

    return NextResponse.json(renewal, { status: 201 });
  } catch (error) {
    console.error('Error creating renewal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
