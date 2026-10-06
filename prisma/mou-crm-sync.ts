/**
 * Đưa đối tác MOU vào CRM (chạy sau prisma/mou-crm-match.ts):
 *
 *   npx tsx prisma/mou-crm-sync.ts [--dry-run]
 *
 * 1. Đối tác chưa có trong CRM → tạo tổ chức (gắn nhãn "Đối tác MOU"), nối MOU.
 *    Nhiều MOU cùng một đơn vị (chỉ khác cách viết) gộp một tổ chức; chi nhánh,
 *    phòng khám khác nhau (vd hai đơn vị Tâm Anh) là hai tổ chức riêng.
 * 2. Người ký phía đối tác và đầu mối liên hệ AI đọc từ biên bản → người liên hệ
 *    của tổ chức (đầu mối được đánh dấu "đầu mối"). Người phía UMC bỏ qua.
 *    Bên ký thứ ba của MOU nhiều bên (vd các Hội) → tổ chức riêng.
 * Chạy lại không tạo trùng: tổ chức khớp theo tên chuẩn hoá, người khớp theo tên ở đúng tổ chức đó.
 */
import type { CrmOrganizationType, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { normalizeOrganizationName, toSearchKey } from '@/lib/crm/constants';
import { distinctiveTokens, nameScore } from '@/lib/mou/crm-match';
import type { MouExtraction } from '@/lib/mou/extract';
import { partnerTypeOf } from '@/lib/mou/portfolio';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const TAG = 'Đối tác MOU';
const ORG_TYPE: Record<string, CrmOrganizationType> = {
  HOSPITAL: 'HOSPITAL', ACADEMIC: 'UNIVERSITY', COMPANY: 'COMPANY', GOVERNMENT: 'GOVERNMENT', NONPROFIT: 'OTHER', OTHER: 'OTHER',
};

type Org = { id: string; name: string; aliases: string[]; tags: string[] };
const unitKey = (name: string) => distinctiveTokens(name).sort().join(' ');
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

async function main() {
  const orgs: Org[] = await prisma.crmOrganization.findMany({ select: { id: true, name: true, aliases: true, tags: true } });
  const mous = await prisma.mOU.findMany({
    where: { deletedAt: null },
    select: { id: true, partnerName: true, partnerCountry: true, category: true, crmOrganizationId: true, crmMatch: true, extraction: true },
    orderBy: { signedDate: 'asc' },
  });
  const stats = { orgsCreated: 0, mousLinked: 0, contactsCreated: 0, positionsCreated: 0, focal: 0 };
  const now = new Date().toISOString();

  /** Tìm tổ chức trùng tên (chuẩn hoá) hoặc cùng bộ từ phân biệt; không có thì tạo. */
  async function ensureOrg(name: string, opts: { foreign: boolean; alias?: string[]; fuzzy?: boolean }): Promise<Org> {
    const key = unitKey(name);
    const found =
      orgs.find((o) => [o.name, ...o.aliases].some((n) => normalizeOrganizationName(n) === normalizeOrganizationName(name) || (key && unitKey(n) === key))) ??
      // Bên ký thứ ba: tên trong biên bản thường ngắn hơn tên trong CRM ("Cục Quản lý Khám, chữa bệnh" ⊂ "… - Bộ Y tế").
      (opts.fuzzy && distinctiveTokens(name).length >= 2
        ? orgs.find((o) => [o.name, ...o.aliases].some((n) => nameScore(name, n) === 1))
        : undefined);
    if (found) {
      const extra = [name, ...(opts.alias ?? [])].filter((n) => ![found.name, ...found.aliases].some((k) => normalizeOrganizationName(k) === normalizeOrganizationName(n)));
      if (extra.length && !dryRun) {
        found.aliases = [...found.aliases, ...extra];
        await prisma.crmOrganization.update({ where: { id: found.id }, data: { aliases: found.aliases, searchKey: toSearchKey(found.name, ...found.aliases) } });
      }
      return found;
    }
    const aliases = [...new Set((opts.alias ?? []).filter((a) => normalizeOrganizationName(a) !== normalizeOrganizationName(name)))];
    console.log(`  + tổ chức mới: ${name}${aliases.length ? ` (tên khác: ${aliases.join('; ')})` : ''}`);
    stats.orgsCreated += 1;
    const data = {
      name: clean(name),
      normalizedName: normalizeOrganizationName(name),
      searchKey: toSearchKey(name, ...aliases),
      type: ORG_TYPE[partnerTypeOf(name)],
      scope: opts.foreign ? 'Nước ngoài' : 'Trong nước',
      tags: [TAG],
      aliases,
      note: 'Tạo từ phân hệ Hợp tác (MOU).',
    };
    const org = dryRun ? { id: `dry-${stats.orgsCreated}`, name: data.name, aliases, tags: [TAG] } : await prisma.crmOrganization.create({ data, select: { id: true, name: true, aliases: true, tags: true } });
    orgs.push(org);
    return org;
  }

  // ── 1. Tổ chức cho đối tác chưa có trong CRM ──
  for (const m of mous) {
    if (m.crmOrganizationId) continue;
    const ex = m.extraction as MouExtraction | null;
    const partyName = ex?.parties.find((p) => p.side === 'PARTNER' && nameScore(p.name, m.partnerName) >= 0.6)?.name;
    const foreign = m.category === 'INTERNATIONAL' || Boolean(m.partnerCountry && m.partnerCountry !== 'Việt Nam');
    const org = await ensureOrg(m.partnerName, { foreign, alias: partyName ? [partyName] : [] });
    m.crmOrganizationId = org.id;
    stats.mousLinked += 1;
    console.log(`  ↔ ${m.partnerName} → ${org.name}`);
    if (!dryRun) {
      await prisma.mOU.update({
        where: { id: m.id },
        data: { crmOrganizationId: org.id, crmMatch: { by: 'AI', relation: 'SAME', confidence: 'high', reason: 'Đối tác chưa có trong CRM — tạo tổ chức từ MOU', at: now } as Prisma.InputJsonValue },
      });
    }
  }

  // ── 2. Người ký và đầu mối phía đối tác ──
  for (const m of mous) {
    const ex = m.extraction as MouExtraction | null;
    if (!ex || !m.crmOrganizationId) continue;
    const mouOrg = orgs.find((o) => o.id === m.crmOrganizationId);
    const people: Array<{ name: string; title: string; focal: boolean; orgName: string; contact: string | null }> = [];
    for (const p of ex.parties) {
      if (p.side !== 'PARTNER' || !p.representative) continue;
      people.push({ name: p.representative, title: p.position ?? 'Người ký MOU', focal: false, orgName: p.name, contact: null });
    }
    for (const c of ex.contactPoints) {
      if (c.side !== 'PARTNER') continue;
      people.push({ name: c.name, title: c.position ?? 'Đầu mối liên hệ', focal: true, orgName: m.partnerName, contact: c.contact });
    }
    // MOU nhiều bên: tên đối tác trên office gộp mọi bên — chỉ so với tên tổ chức đã nối.
    const multiParty = ex.parties.filter((p) => p.side === 'PARTNER').length > 1;
    for (const person of people) {
      // Bên ký là chính đối tác (hoặc tên khác của tổ chức đã nối) → tổ chức của MOU; bên thứ ba → tổ chức riêng.
      const ownNames = mouOrg ? [mouOrg.name, ...mouOrg.aliases, ...(multiParty ? [] : [m.partnerName])] : [];
      const own = ownNames.some((n) => nameScore(n, person.orgName) >= 0.6);
      const org = own ? mouOrg! : await ensureOrg(person.orgName, { foreign: false, fuzzy: true });
      await upsertPerson(org, person);
    }
  }

  async function upsertPerson(org: Org, p: { name: string; title: string; focal: boolean; contact: string | null }) {
    const fullName = clean(p.name);
    const email = p.contact?.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? null;
    const phone = p.contact?.match(/(\+?\d[\d .-]{7,}\d)/)?.[1]?.replace(/[ .-]/g, '') ?? null;
    const existing = dryRun || org.id.startsWith('dry-')
      ? null
      : await prisma.crmPosition.findFirst({
          where: { organizationId: org.id, contact: { searchKey: { startsWith: toSearchKey(fullName) } } },
          select: { id: true, isFocalPoint: true, contactId: true },
        });
    if (existing) {
      if (p.focal && !existing.isFocalPoint) {
        await prisma.crmPosition.update({ where: { id: existing.id }, data: { isFocalPoint: true } });
        stats.focal += 1;
      }
      return;
    }
    console.log(`  + ${p.focal ? 'đầu mối' : 'người ký'}: ${fullName} — ${p.title} @ ${org.name}`);
    stats.contactsCreated += 1;
    stats.positionsCreated += 1;
    if (p.focal) stats.focal += 1;
    if (dryRun) return;
    const contact = await prisma.crmContact.create({
      data: { fullName, searchKey: toSearchKey(fullName, phone), phone, email, tags: [TAG], source: 'Biên bản MOU (AI đọc)' },
      select: { id: true },
    });
    await prisma.crmPosition.create({ data: { contactId: contact.id, organizationId: org.id, title: p.title.slice(0, 300), isCurrent: true, isFocalPoint: p.focal } });
  }

  console.log(
    `${dryRun ? '(chạy thử) ' : ''}Tạo ${stats.orgsCreated} tổ chức, nối ${stats.mousLinked} MOU, thêm ${stats.contactsCreated} người liên hệ (${stats.focal} đầu mối)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
