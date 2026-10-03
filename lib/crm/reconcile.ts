import type { PrismaClient } from '@prisma/client';

/** Danh mục trong Excel báo cáo tuần Phòng HC (bảng hc_metrics) tương ứng với CRM. */
const EXCEL_VIP_CATEGORY = 'Đón tiếp khách VIP';
const EXCEL_DELEGATION_CATEGORY = 'Tiếp khách trong nước';
const EXCEL_DELEGATION_TOTAL_PREFIX = 'Tổng số đoàn';

export interface ReconcileRow {
  year: number;
  month: number;
  excelVip: number | null;
  crmVip: number;
  excelDelegations: number | null;
  crmDelegations: number;
}

/**
 * Đối chiếu số lượt dẫn khám VIP và số đoàn giữa CRM (lượt đã thực hiện) và Excel
 * báo cáo tuần, theo tháng. Excel trống (chưa đồng bộ) thì để null, không phải 0.
 */
export async function reconcileWithExcel(db: PrismaClient, today: string, months: number): Promise<ReconcileRow[]> {
  const [year, month] = today.split('-').map(Number);
  const periods = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  });
  const oldest = periods[periods.length - 1];
  const from = new Date(`${oldest.year}-${String(oldest.month).padStart(2, '0')}-01T00:00:00+07:00`);

  const [excel, crm] = await Promise.all([
    db.hcMetric.groupBy({
      by: ['year', 'month', 'category'],
      where: {
        OR: [
          { category: EXCEL_VIP_CATEGORY },
          { category: EXCEL_DELEGATION_CATEGORY, content: { startsWith: EXCEL_DELEGATION_TOTAL_PREFIX } },
        ],
        year: { gte: oldest.year },
      },
      _sum: { value: true },
    }),
    db.$queryRaw<Array<{ year: number; month: number; type: string; n: number }>>`
      SELECT EXTRACT(YEAR FROM "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS year,
             EXTRACT(MONTH FROM "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS month,
             type::text AS type, COUNT(*)::int AS n
      FROM crm_interactions
      WHERE status = 'DONE' AND type IN ('VIP_ESCORT', 'DELEGATION') AND "occurredAt" >= ${from}
      GROUP BY 1, 2, 3`,
  ]);

  const excelOf = (p: { year: number; month: number }, category: string) => {
    const row = excel.find((e) => e.year === p.year && e.month === p.month && e.category === category);
    return row?._sum.value ?? null;
  };
  const crmOf = (p: { year: number; month: number }, type: string) =>
    crm.find((c) => c.year === p.year && c.month === p.month && c.type === type)?.n ?? 0;

  return periods.map((p) => ({
    ...p,
    excelVip: excelOf(p, EXCEL_VIP_CATEGORY),
    crmVip: crmOf(p, 'VIP_ESCORT'),
    excelDelegations: excelOf(p, EXCEL_DELEGATION_CATEGORY),
    crmDelegations: crmOf(p, 'DELEGATION'),
  }));
}
