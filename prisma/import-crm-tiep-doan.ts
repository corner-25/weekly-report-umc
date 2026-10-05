/**
 * Nạp sổ tiếp đoàn đã chuẩn hoá vào CRM: tổ chức (theo Mã tổ chức) rồi lượt
 * tiếp đoàn (theo Mã đoàn). Chạy lại được — đã có thì cập nhật, không tạo trùng.
 *
 *   python3 tools/crm-import/tiepdoan_to_json.py TiepDoan_ChuanHoa_2022-2026.xlsx /tmp/tiepdoan.json
 *   npx tsx prisma/import-crm-tiep-doan.ts /tmp/tiepdoan.json [--dry-run]
 *
 * Tổ chức đã có trong CRM (trùng tên chuẩn hoá hoặc tên không dấu) được gắn mã,
 * không tạo bản mới; hạng, người phụ trách, ghi chú của tổ chức không bị đụng tới.
 */
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { normalizeOrganizationName, toSearchKey } from '@/lib/crm/constants';
import { toDelegation, toOrganization, unitKey, type SheetRow } from '@/lib/crm/delegation-import';

const prisma = new PrismaClient();

async function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  if (!file) throw new Error('Cần đường dẫn file JSON (xem đầu file)');
  const payload = JSON.parse(readFileSync(file, 'utf-8')) as { organizations: SheetRow[]; delegations: SheetRow[] };

  const orgs = payload.organizations.map(toOrganization).filter((o) => o !== null);
  const delegations = payload.delegations.map(toDelegation).filter((d) => d !== null);
  console.log(`Đọc ${orgs.length} tổ chức, ${delegations.length} lượt tiếp đoàn${dryRun ? ' (chạy thử, không ghi)' : ''}`);

  // ── Tổ chức ──
  const existing = await prisma.crmOrganization.findMany({ select: { id: true, externalCode: true, normalizedName: true, searchKey: true, aliases: true } });
  const orgIdByCode = new Map<string, string>();
  let orgCreated = 0;
  let orgLinked = 0;
  for (const o of orgs) {
    const normalizedName = normalizeOrganizationName(o.name);
    const searchKey = toSearchKey(o.name, ...o.aliases);
    const match =
      existing.find((e) => e.externalCode === o.externalCode) ??
      existing.find((e) => !e.externalCode && [o.name, ...o.aliases].some((n) => e.normalizedName === normalizeOrganizationName(n) || e.searchKey === toSearchKey(n)));
    const fields = { externalCode: o.externalCode, category: o.category, scope: o.scope, type: o.type };
    if (dryRun) {
      orgIdByCode.set(o.externalCode, match?.id ?? `new:${o.externalCode}`);
      if (match) orgLinked += 1;
      else orgCreated += 1;
      continue;
    }
    if (match) {
      const saved = await prisma.crmOrganization.update({
        where: { id: match.id },
        data: { ...fields, aliases: [...new Set([...match.aliases, ...o.aliases])] },
        select: { id: true },
      });
      orgIdByCode.set(o.externalCode, saved.id);
      orgLinked += 1;
    } else {
      const saved = await prisma.crmOrganization.create({
        data: { ...fields, name: o.name, normalizedName, searchKey, aliases: o.aliases, note: o.mergeNote },
        select: { id: true },
      });
      orgIdByCode.set(o.externalCode, saved.id);
      orgCreated += 1;
    }
  }
  console.log(`Tổ chức: ${orgCreated} mới, ${orgLinked} khớp tổ chức có sẵn/đã nạp`);

  // ── Khoa/phòng chủ trì ──
  const departments = await prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const deptByKey = new Map(departments.map((d) => [unitKey(d.name), d]));
  const unmatchedHosts = new Map<string, number>();

  // ── Lượt tiếp đoàn ──
  let created = 0;
  let updated = 0;
  const missingOrg: string[] = [];
  for (const d of delegations) {
    const organizationId = d.organizationCode ? orgIdByCode.get(d.organizationCode) : undefined;
    if (d.organizationCode && !organizationId) missingOrg.push(`${d.externalCode}→${d.organizationCode}`);
    const host = d.hostCandidates.map((name) => deptByKey.get(unitKey(name))).find(Boolean) ?? null;
    if (d.hostUnit && !host) unmatchedHosts.set(d.hostUnit, (unmatchedHosts.get(d.hostUnit) ?? 0) + 1);
    if (dryRun) continue;

    const { organizationCode: _code, hostCandidates: _hosts, ...fields } = d;
    const data = {
      ...fields,
      type: 'DELEGATION' as const,
      staffName: '',
      organizationId: organizationId ?? null,
      hostDepartmentId: host?.id ?? null,
      hostUnit: host?.name ?? d.hostUnit,
    };
    const before = await prisma.crmInteraction.findUnique({ where: { externalCode: d.externalCode }, select: { id: true, staffName: true } });
    if (before) {
      // Người dẫn Phòng HC ghi tay sau khi nạp thì giữ.
      await prisma.crmInteraction.update({ where: { id: before.id }, data: { ...data, staffName: before.staffName } });
      updated += 1;
    } else {
      await prisma.crmInteraction.create({ data });
      created += 1;
    }
  }

  console.log(`Lượt tiếp đoàn: ${created} mới, ${updated} cập nhật`);
  if (missingOrg.length) console.log(`Không tìm thấy tổ chức cho: ${missingOrg.join(', ')}`);
  if (unmatchedHosts.size) {
    console.log('Đơn vị chủ trì chưa khớp danh mục khoa/phòng (giữ tên như ghi nhận):');
    for (const [name, n] of unmatchedHosts) console.log(`  - ${name} (${n})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
