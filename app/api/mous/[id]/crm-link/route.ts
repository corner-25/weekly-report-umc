import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CrmOrganizationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { normalizeOrganizationName, toSearchKey } from '@/lib/crm/constants';
import { partnerTypeOf } from '@/lib/mou/portfolio';
import { refreshMouKnowledge } from '@/lib/mou/knowledge-refresh';

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.union([
  z.object({ organizationId: z.string().min(1).nullable() }),
  z.object({ create: z.literal(true) }),
]);

/** Loại tổ chức CRM suy từ loại đối tác MOU. */
const ORG_TYPE: Record<string, CrmOrganizationType> = {
  HOSPITAL: 'HOSPITAL', ACADEMIC: 'UNIVERSITY', COMPANY: 'COMPANY', GOVERNMENT: 'GOVERNMENT', NONPROFIT: 'OTHER', OTHER: 'OTHER',
};

/**
 * Phòng HC chọn/bỏ tổ chức CRM tương ứng với đối tác MOU, hoặc tạo tổ chức mới
 * trong CRM từ tên đối tác (đối tác ký MOU chưa có trong danh bạ).
 */
export const PUT = handle(async (request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const body = bodySchema.parse(await request.json());
  const mou = await prisma.mOU.findFirst({ where: { id, deletedAt: null }, select: { partnerName: true, partnerCountry: true, category: true } });
  if (!mou) throw new HttpError(404, 'Không tìm thấy MOU');
  const by = session.user?.name || session.user?.email || 'Phòng HC';
  const at = new Date().toISOString();

  let organizationId: string | null;
  if ('create' in body) {
    const name = mou.partnerName.replace(/\s+/g, ' ').trim();
    const normalizedName = normalizeOrganizationName(name);
    const existing = await prisma.crmOrganization.findFirst({ where: { OR: [{ normalizedName }, { searchKey: toSearchKey(name) }] }, select: { id: true } });
    const foreign = mou.category === 'INTERNATIONAL' || (mou.partnerCountry && mou.partnerCountry !== 'Việt Nam');
    organizationId =
      existing?.id ??
      (
        await prisma.crmOrganization.create({
          data: {
            name,
            normalizedName,
            searchKey: toSearchKey(name),
            type: ORG_TYPE[partnerTypeOf(name)],
            scope: foreign ? 'Nước ngoài' : 'Trong nước',
            tags: ['Đối tác MOU'],
            note: 'Tạo từ phân hệ Hợp tác (MOU).',
          },
          select: { id: true },
        })
      ).id;
  } else {
    organizationId = body.organizationId;
    if (organizationId && !(await prisma.crmOrganization.count({ where: { id: organizationId } }))) throw new HttpError(404, 'Không tìm thấy tổ chức trong CRM');
  }

  const crmMatch = { by: 'MANUAL', relation: organizationId ? 'SAME' : 'NONE', confidence: 'high', reason: `${'create' in body ? 'Tạo mới trong CRM' : organizationId ? 'Chọn tay' : 'Bỏ liên kết'} — ${by}`, at };
  const updated = await prisma.mOU.update({
    where: { id },
    data: { crmOrganizationId: organizationId, crmMatch: crmMatch as Prisma.InputJsonValue },
    select: { crmOrganizationId: true, crmMatch: true, crmOrganization: { select: { id: true, name: true } } },
  });
  refreshMouKnowledge();
  return NextResponse.json(updated);
});
