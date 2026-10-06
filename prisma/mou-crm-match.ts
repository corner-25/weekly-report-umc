/**
 * Ghép đối tác MOU với tổ chức trong CRM (chuẩn hoá danh mục đối tác).
 *
 *   npx tsx prisma/mou-crm-match.ts [--dry-run] [--force]
 *
 * Chấm điểm tên để lọc ứng viên, rồi Z.AI quyết định cùng đơn vị hay không.
 * Chắc chắn (cùng đơn vị, tin cậy cao/trung bình) thì nối MOU ↔ tổ chức và thêm
 * tên MOU vào "tên khác" của tổ chức; nghi ngờ thì chỉ lưu gợi ý để Phòng HC xem.
 * Liên kết Phòng HC tự chọn (by MANUAL) không bị ghi đè; --force làm lại các liên kết AI.
 */
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { callJson } from '@/lib/ai/zai';
import { AI_MODELS } from '@/lib/ai/models';
import { normalizeOrganizationName, toSearchKey } from '@/lib/crm/constants';
import { buildMatchPrompt, parseMatch, rankCandidates, type MatchItem } from '@/lib/mou/crm-match';

const prisma = new PrismaClient();
const BATCH = 10;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true, aliases: true, category: true, scope: true } });
  const mous = await prisma.mOU.findMany({
    where: { deletedAt: null },
    select: { id: true, partnerName: true, partnerCountry: true, cooperationField: true, crmOrganizationId: true, crmMatch: true },
    orderBy: { partnerName: 'asc' },
  });
  const todo = mous.filter((m) => {
    const by = (m.crmMatch as { by?: string } | null)?.by;
    return by !== 'MANUAL' && (force || !m.crmMatch);
  });
  const withCands = todo.map((m) => ({ mou: m, candidates: rankCandidates(m.partnerName, orgs) }));
  const noCand = withCands.filter((x) => !x.candidates.length);
  const ask = withCands.filter((x) => x.candidates.length);
  console.log(`${todo.length} MOU cần ghép · ${ask.length} có ứng viên · ${noCand.length} không có tổ chức nào gần tên trong CRM`);

  let tokens = 0;
  const stats = { linked: 0, suggested: 0, none: 0 };
  const now = new Date().toISOString();
  for (let i = 0; i < ask.length; i += BATCH) {
    const batch = ask.slice(i, i + BATCH);
    const items: MatchItem[] = batch.map((x) => ({ partnerName: x.mou.partnerName, partnerCountry: x.mou.partnerCountry, field: x.mou.cooperationField, candidates: x.candidates }));
    const { data, usage } = await callJson<unknown>(buildMatchPrompt(items), { model: AI_MODELS.summary, maxTokens: 3000, temperature: 0 });
    tokens += usage.totalTokens;
    const results = parseMatch(data);
    for (const r of results) {
      const x = batch[r.mou - 1];
      if (!x) continue;
      const cand = r.match ? x.candidates[Number(r.match.replace(/\D/g, '')) - 1] : undefined;
      const linked = Boolean(cand) && r.relation !== 'NONE' && r.confidence !== 'low';
      const tag = linked ? '✓ nối ' : cand ? '? gợi ý' : '– không';
      console.log(`${tag} ${x.mou.partnerName}${cand ? ` → ${cand.name} [${r.relation}, ${r.confidence}]` : ''} — ${r.reason}`);
      stats[linked ? 'linked' : cand ? 'suggested' : 'none'] += 1;
      if (dryRun) continue;
      const match = { by: 'AI', relation: r.relation, confidence: r.confidence, reason: r.reason, at: now, ...(cand && !linked ? { suggestionId: cand.id, suggestionName: cand.name } : {}) };
      await prisma.mOU.update({
        where: { id: x.mou.id },
        data: { crmOrganizationId: linked ? cand!.id : null, crmMatch: match as Prisma.InputJsonValue },
      });
      // Cùng một đơn vị, chắc chắn: thêm tên trên MOU vào tên khác của tổ chức để tìm trong CRM cũng ra.
      if (linked && r.relation === 'SAME' && r.confidence === 'high') {
        const org = orgs.find((o) => o.id === cand!.id)!;
        const known = [org.name, ...org.aliases].map((n) => normalizeOrganizationName(n));
        if (!known.includes(normalizeOrganizationName(x.mou.partnerName))) {
          const aliases = [...org.aliases, x.mou.partnerName];
          await prisma.crmOrganization.update({ where: { id: org.id }, data: { aliases, searchKey: toSearchKey(org.name, ...aliases) } });
          org.aliases = aliases;
        }
      }
    }
  }
  if (!dryRun) {
    for (const x of noCand) {
      await prisma.mOU.update({ where: { id: x.mou.id }, data: { crmOrganizationId: null, crmMatch: { by: 'AI', relation: 'NONE', confidence: 'high', reason: 'Chưa có tổ chức này trong CRM', at: now } } });
    }
  }
  stats.none += noCand.length;
  noCand.forEach((x) => console.log(`– chưa có trong CRM: ${x.mou.partnerName}`));
  console.log(`${dryRun ? '(chạy thử) ' : ''}Nối ${stats.linked} · gợi ý cần xem ${stats.suggested} · chưa có trong CRM ${stats.none} · ${tokens.toLocaleString('vi-VN')} token`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
