import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  applicationFieldsSchema,
  toPrismaPayload,
  autoAdvanceStatus,
} from '@/lib/application-fields';
import type { ApplicationStatus, ScreeningResult } from '@prisma/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const application = await prisma.secretaryApplication.findFirst({
      where: { id, deletedAt: null },
      include: {
        appliedType: true,
        desiredDepartment: true,
        convertedSecretary: { select: { id: true, fullName: true, currentDepartment: true } },
      },
    });
    if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = applicationFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }

    const existing = await prisma.secretaryApplication.findUnique({
      where: { id },
      select: { status: true, screeningResult: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const payload = toPrismaPayload(parsed.data);

    // Auto-advance: use the effective screening result (new value if provided,
    // else existing) and the proposed status.
    const effectiveResult: ScreeningResult | null | undefined =
      'screeningResult' in payload
        ? (payload.screeningResult as ScreeningResult | null)
        : existing.screeningResult;
    const advanced = autoAdvanceStatus({
      currentStatus: existing.status,
      proposedStatus: payload.status as ApplicationStatus | undefined,
      proposedResult: effectiveResult,
    });
    if (advanced) payload.status = advanced;

    const application = await prisma.secretaryApplication.update({
      where: { id },
      data: payload as Parameters<typeof prisma.secretaryApplication.update>[0]['data'],
      include: { appliedType: true, desiredDepartment: true },
    });
    return NextResponse.json(application);
  } catch (error) {
    console.error('Error updating application:', error);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.secretaryApplication.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting application:', error);
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 });
  }
}
