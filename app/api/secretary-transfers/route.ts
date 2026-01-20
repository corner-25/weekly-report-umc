import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Lấy danh sách lịch sử luân chuyển
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const secretaryId = searchParams.get('secretaryId');
    const departmentId = searchParams.get('departmentId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const where: any = {};

    if (secretaryId) {
      where.secretaryId = secretaryId;
    }

    if (departmentId) {
      where.OR = [
        { fromDepartmentId: departmentId },
        { toDepartmentId: departmentId }
      ];
    }

    if (fromDate) {
      where.transferDate = {
        ...where.transferDate,
        gte: new Date(fromDate)
      };
    }

    if (toDate) {
      where.transferDate = {
        ...where.transferDate,
        lte: new Date(toDate)
      };
    }

    const transfers = await prisma.secretaryTransferLog.findMany({
      where,
      include: {
        secretary: {
          select: { id: true, fullName: true, avatar: true }
        },
        fromDepartment: {
          select: { id: true, name: true }
        },
        toDepartment: {
          select: { id: true, name: true }
        }
      },
      orderBy: { transferDate: 'desc' }
    });

    return NextResponse.json(transfers);
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      { status: 500 }
    );
  }
}

// POST - Tạo bản ghi luân chuyển mới
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      secretaryId,
      toDepartmentId,
      transferDate,
      decisionNumber,
      reason,
      notes
    } = body;

    if (!secretaryId || !toDepartmentId) {
      return NextResponse.json(
        { error: 'secretaryId và toDepartmentId là bắt buộc' },
        { status: 400 }
      );
    }

    // Get current department of secretary
    const secretary = await prisma.secretary.findUnique({
      where: { id: secretaryId },
      select: { currentDepartmentId: true }
    });

    if (!secretary) {
      return NextResponse.json(
        { error: 'Không tìm thấy thư ký' },
        { status: 404 }
      );
    }

    // Create transfer log
    const transfer = await prisma.secretaryTransferLog.create({
      data: {
        secretaryId,
        fromDepartmentId: secretary.currentDepartmentId,
        toDepartmentId,
        transferDate: transferDate ? new Date(transferDate) : new Date(),
        decisionNumber: decisionNumber?.trim() || null,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: {
        secretary: {
          select: { id: true, fullName: true }
        },
        fromDepartment: {
          select: { id: true, name: true }
        },
        toDepartment: {
          select: { id: true, name: true }
        }
      }
    });

    // Update secretary's current department
    await prisma.secretary.update({
      where: { id: secretaryId },
      data: { currentDepartmentId: toDepartmentId }
    });

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    console.error('Error creating transfer:', error);
    return NextResponse.json(
      { error: 'Failed to create transfer' },
      { status: 500 }
    );
  }
}
