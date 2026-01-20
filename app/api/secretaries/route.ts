import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Lấy danh sách thư ký với filter
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');
    const typeId = searchParams.get('typeId');
    const status = searchParams.get('status');
    const birthdayMonth = searchParams.get('birthdayMonth');

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.currentDepartmentId = departmentId;
    }

    if (typeId) {
      where.secretaryTypeId = typeId;
    }

    if (status) {
      where.status = status;
    }

    // Filter by birthday month
    if (birthdayMonth) {
      const month = parseInt(birthdayMonth);
      if (month >= 1 && month <= 12) {
        where.dateOfBirth = {
          not: null,
        };
      }
    }

    const secretaries = await prisma.secretary.findMany({
      where,
      include: {
        secretaryType: true,
        currentDepartment: true,
        certificates: {
          orderBy: { issuedYear: 'desc' }
        },
        _count: {
          select: { transferLogs: true }
        }
      },
      orderBy: { fullName: 'asc' }
    });

    // Filter by birthday month in memory (Prisma doesn't support month extraction)
    let filteredSecretaries = secretaries;
    if (birthdayMonth) {
      const month = parseInt(birthdayMonth);
      filteredSecretaries = secretaries.filter(s => {
        if (!s.dateOfBirth) return false;
        return new Date(s.dateOfBirth).getMonth() + 1 === month;
      });
    }

    return NextResponse.json(filteredSecretaries);
  } catch (error) {
    console.error('Error fetching secretaries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch secretaries' },
      { status: 500 }
    );
  }
}

// POST - Tạo thư ký mới
export async function POST(request: NextRequest) {
  try {
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
      certificates,
    } = body;

    if (!fullName || fullName.trim() === '') {
      return NextResponse.json(
        { error: 'Họ và tên không được để trống' },
        { status: 400 }
      );
    }

    const newSecretary = await prisma.secretary.create({
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
        certificates: certificates && certificates.length > 0 ? {
          create: certificates.map((cert: any) => ({
            name: cert.name,
            issuedYear: cert.issuedYear ? parseInt(cert.issuedYear) : null,
            issuedBy: cert.issuedBy || null,
            notes: cert.notes || null,
          }))
        } : undefined
      },
      include: {
        secretaryType: true,
        currentDepartment: true,
        certificates: true,
      }
    });

    // If department is set, create initial transfer log
    if (currentDepartmentId) {
      await prisma.secretaryTransferLog.create({
        data: {
          secretaryId: newSecretary.id,
          toDepartmentId: currentDepartmentId,
          transferDate: startDate ? new Date(startDate) : new Date(),
          reason: 'Phân công ban đầu',
        }
      });
    }

    return NextResponse.json(newSecretary, { status: 201 });
  } catch (error) {
    console.error('Error creating secretary:', error);
    return NextResponse.json(
      { error: 'Failed to create secretary' },
      { status: 500 }
    );
  }
}
