import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const typeId = searchParams.get('typeId');
    const departmentId = searchParams.get('departmentId');

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (typeId) where.appliedTypeId = typeId;
    if (departmentId) where.desiredDepartmentId = departmentId;

    const applications = await prisma.secretaryApplication.findMany({
      where,
      include: {
        appliedType: true,
        desiredDepartment: true,
        convertedSecretary: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, dateOfBirth, phone, email, cvUrl, appliedTypeId, desiredDepartmentId, source, notes } = body;

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Họ và tên không được để trống' }, { status: 400 });
    }

    const application = await prisma.secretaryApplication.create({
      data: {
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        cvUrl: cvUrl?.trim() || null,
        appliedTypeId: appliedTypeId || null,
        desiredDepartmentId: desiredDepartmentId || null,
        source: source?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: { appliedType: true, desiredDepartment: true },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
  }
}
