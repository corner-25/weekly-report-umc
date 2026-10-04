/**
 * Nạp danh mục chỉ số chuẩn của một phòng từ prisma/metric-catalog/<phòng>.json.
 *
 * File JSON là nguồn chân lý đã duyệt: cây chỉ số (nodes) và mọi cách viết
 * khác của từng chỉ số (aliases). Chạy lại nhiều lần cho cùng kết quả (upsert).
 *
 * Chạy: npx tsx prisma/load-metric-catalog.ts prisma/metric-catalog/phong-hanh-chinh.json
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

interface CatalogNode {
  code: string;
  parent: string | null;
  name: string;
  kind: 'GROUP' | 'METRIC';
  unit: string | null;
  agg: 'SUM' | 'LAST' | 'AVG' | null;
  hc: [string, string] | null;
  origin: 'EXCEL' | 'REPORT';
  /** Cộng các khoản rời trong cùng tuần (mặc định: lấy một số). */
  sumWithinWeek?: boolean;
}

interface CatalogAlias {
  name: string;
  unit: string;
  code: string | null;
  status: 'MAPPED' | 'VALUE' | 'SPORADIC' | 'NOISE';
  candidates: string[];
  weeks: number;
}

interface Catalog {
  department: string;
  model: string;
  nodes: CatalogNode[];
  aliases: CatalogAlias[];
}

const prisma = new PrismaClient();

/** Cha trước con, để khoá ngoại parentCode luôn trỏ tới node đã có. */
function parentsFirst(nodes: CatalogNode[]): CatalogNode[] {
  // Theo quan hệ cha thật, không theo số dấu chấm trong mã: nhánh tổng đài
  // "hc.switchboard.nhanh_1" có cùng độ sâu mã với node tổng là cha của nó.
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const depth = (n: CatalogNode): number => (n.parent ? 1 + depth(byCode.get(n.parent)!) : 0);
  return [...nodes].sort((a, b) => depth(a) - depth(b));
}

function validate(catalog: Catalog): void {
  const codes = new Set(catalog.nodes.map((n) => n.code));
  for (const n of catalog.nodes) {
    if (n.parent && !codes.has(n.parent)) throw new Error(`Node ${n.code}: cha "${n.parent}" không có trong file`);
  }
  for (const a of catalog.aliases) {
    if (a.status === 'MAPPED' && !(a.code && codes.has(a.code))) {
      throw new Error(`Tên "${a.name}": MAPPED nhưng mã "${a.code}" không có trong cây`);
    }
    const unknown = a.candidates.filter((c) => !codes.has(c));
    if (unknown.length > 0) throw new Error(`Tên "${a.name}": ứng viên không có trong cây: ${unknown.join(', ')}`);
  }
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) throw new Error('Thiếu đường dẫn file danh mục');
  const catalog = JSON.parse(readFileSync(file, 'utf8')) as Catalog;
  validate(catalog);

  const department = await prisma.department.findFirst({
    where: { name: catalog.department, deletedAt: null },
    select: { id: true },
  });
  if (!department) throw new Error(`Không tìm thấy phòng "${catalog.department}"`);

  let order = 0;
  for (const n of parentsFirst(catalog.nodes)) {
    order += 1;
    const data = {
      departmentId: department.id,
      parentCode: n.parent,
      name: n.name,
      kind: n.kind,
      unit: n.unit,
      aggregation: n.agg,
      hcCategory: n.hc?.[0] ?? null,
      hcContent: n.hc?.[1] ?? null,
      origin: n.origin,
      sumWithinWeek: n.sumWithinWeek ?? false,
      orderNumber: order,
      isActive: true,
    };
    await prisma.metricNode.upsert({ where: { code: n.code }, create: { code: n.code, ...data }, update: data });
  }

  // File là nguồn chân lý: chỉ số của phòng không còn trong file thì tắt (không
  // xoá — tên gọi và số liệu cũ còn trỏ tới). Vd gộp chỉ số "gạch bộp lầu 3",
  // "lầu 7"… thành một chỉ số tổng: các chỉ số theo tầng phải biến khỏi cây.
  const retired = await prisma.metricNode.updateMany({
    where: { departmentId: department.id, isActive: true, code: { notIn: catalog.nodes.map((n) => n.code) } },
    data: { isActive: false },
  });
  if (retired.count > 0) console.info(`  tắt ${retired.count} chỉ số không còn trong danh mục`);

  for (const a of catalog.aliases) {
    const key = { departmentId: department.id, aliasName: a.name, unit: a.unit };
    const existing = await prisma.metricAlias.findUnique({
      where: { departmentId_aliasName_unit: key },
      select: { decidedBy: true },
    });
    // Cách gắn người đã sửa tay thì giữ — chỉ cập nhật số tuần đã gặp.
    if (existing?.decidedBy === 'HUMAN') {
      await prisma.metricAlias.update({ where: { departmentId_aliasName_unit: key }, data: { weeksSeen: a.weeks } });
      continue;
    }
    const data = {
      nodeCode: a.status === 'MAPPED' ? a.code : null,
      status: a.status,
      candidates: a.candidates,
      decidedBy: 'AI',
      model: catalog.model,
      weeksSeen: a.weeks,
    };
    await prisma.metricAlias.upsert({
      where: { departmentId_aliasName_unit: key },
      create: { ...key, ...data },
      update: data,
    });
  }

  console.info(`✓ ${catalog.department}: ${catalog.nodes.length} chỉ số/nhóm · ${catalog.aliases.length} tên gọi`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
