import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import type { MouRow } from '@/lib/mou/portfolio';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const latest = (...dates: Array<Date | null | undefined>) =>
  dates.reduce<Date | null>((max, d) => (d && (!max || d > max) ? d : max), null);

/**
 * Mọi MOU dạng dòng nhẹ cho bảng điều hành và danh sách — trang tự tính chỉ số,
 * lọc, sắp xếp (vài trăm dòng), khỏi gọi lại API mỗi lần đổi bộ lọc.
 */
export const GET = handle(async () => {
  await requireSession();
  const [mous, departments] = await Promise.all([
    prisma.mOU.findMany({
      where: { deletedAt: null },
      select: {
        id: true, title: true, partnerName: true, partnerCountry: true, category: true, status: true,
        externalStatus: true, cooperationField: true, departmentId: true, contactPerson: true,
        signedDate: true, expiryDate: true, progressPercent: true, updatedAt: true, assessment: true, evaluation: true,
        department: { select: { name: true } },
        clauses: { orderBy: { orderNumber: 'asc' }, select: { progress: true, clauseType: true, clauseStatus: true, clauseProgress: { select: { date: true }, orderBy: { date: 'desc' }, take: 1 } } },
        progressLogs: { select: { date: true }, orderBy: { date: 'desc' }, take: 1 },
        activities: { select: { startDate: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { documents: true, activities: true } },
      },
    }),
    prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const rows: MouRow[] = mous.map((m) => {
    const clauseProgress = m.clauses.length ? Math.round(m.clauses.reduce((s, c) => s + c.progress, 0) / m.clauses.length) : null;
    return {
      id: m.id,
      title: m.title,
      partnerName: m.partnerName,
      partnerCountry: m.partnerCountry,
      category: m.category,
      status: m.status,
      externalStatus: m.externalStatus,
      cooperationField: m.cooperationField,
      departmentId: m.departmentId,
      departmentName: m.department?.name ?? null,
      contactPerson: m.contactPerson,
      signedDate: iso(m.signedDate),
      expiryDate: iso(m.expiryDate),
      // Khía cạnh đã có tiến độ (AI đối chiếu hoặc Phòng HC ghi) thì lấy; chưa thì lấy % phòng đầu mối ghi trên office.
      progress: clauseProgress ? clauseProgress : m.progressPercent ?? clauseProgress,
      clauseCount: m.clauses.length,
      documentCount: m._count.documents,
      activityCount: m._count.activities,
      lastActivityAt: iso(
        latest(
          m.progressLogs[0]?.date,
          m.activities[0]?.startDate ?? m.activities[0]?.createdAt,
          ...m.clauses.map((c) => c.clauseProgress[0]?.date),
        ),
      ),
      updatedAt: m.updatedAt.toISOString(),
      aiVerdict: (m.assessment as { verdict?: string } | null)?.verdict ?? null,
      evaluation: m.evaluation,
      aspects: m.clauses.map((c) => ({ type: c.clauseType, status: c.clauseStatus })),
    };
  });

  return NextResponse.json({ rows, departments }, { headers: { 'Cache-Control': 'private, max-age=30' } });
});
