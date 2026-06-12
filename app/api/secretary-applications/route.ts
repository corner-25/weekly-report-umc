import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  applicationFieldsSchema,
  toPrismaPayload,
  autoAdvanceStatus,
} from '@/lib/application-fields';
import type { ApplicationStatus, Prisma, ScreeningResult } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const typeId = searchParams.get('typeId');
    const departmentId = searchParams.get('departmentId');

    const where: Prisma.SecretaryApplicationWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status as ApplicationStatus;
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
    const parsed = applicationFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    if (!parsed.data.fullName?.trim()) {
      return NextResponse.json({ error: 'Họ và tên không được để trống' }, { status: 400 });
    }

    const payload = toPrismaPayload(parsed.data);
    const advanced = autoAdvanceStatus({
      currentStatus: undefined,
      proposedStatus: payload.status as ApplicationStatus | undefined,
      proposedResult: payload.screeningResult as ScreeningResult | null | undefined,
    });
    if (advanced) payload.status = advanced;

    const application = await prisma.secretaryApplication.create({
      data: payload as Parameters<typeof prisma.secretaryApplication.create>[0]['data'],
      include: { appliedType: true, desiredDepartment: true },
    });
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
  }
}
