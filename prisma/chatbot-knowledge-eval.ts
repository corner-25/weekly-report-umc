/**
 * Chạy bộ kiểm tra "phân biệt nguồn — liên kết phòng ban" (lib/chatbot/eval/knowledge-cases.ts)
 * qua đúng pipeline chatbot, chấm tự động và lưu kết quả.
 *
 *   DATABASE_URL_RO="$DATABASE_URL" npx tsx prisma/chatbot-knowledge-eval.ts [--only id1,id2] [--out file.json]
 *
 * Chấm 3 tiêu chí mỗi câu: đúng nguồn (dựa trên view đã truy vấn và đoạn văn bản được trích dẫn),
 * có đủ ý bắt buộc, không lẫn đối tượng khác.
 */
import { writeFileSync } from 'fs';
import { runChatbotPipeline } from '@/lib/chatbot/pipeline';
import { getMetricEmbeddings } from '@/lib/chatbot/embeddings';
import { GENERAL_CHATBOT_VIEWS } from '@/lib/chatbot/sql-guard';
import { KNOWLEDGE_SOURCES } from '@/lib/chatbot/knowledge/collect';
import { toSearchKey } from '@/lib/crm/constants';
import { KNOWLEDGE_EVAL_CASES, type KnowledgeEvalCase, type SourceKind } from '@/lib/chatbot/eval/knowledge-cases';

const VIEW_KIND: Array<[RegExp, SourceKind]> = [
  [/v_chatbot_mou/, 'mou'],
  [/v_chatbot_(delegations|vip_summary|crm_)/, 'crm'],
  [/v_chatbot_(tasks|task_threads|metrics|metric_facts|hc_metrics)/, 'weekly_report'],
  [/v_chatbot_work_/, 'work'],
  [/v_chatbot_department/, 'department'],
];
const LABEL_KIND: Record<string, SourceKind> = {
  [KNOWLEDGE_SOURCES.weekly_report]: 'weekly_report',
  [KNOWLEDGE_SOURCES.weekly_summary]: 'weekly_summary',
  [KNOWLEDGE_SOURCES.crm]: 'crm',
  [KNOWLEDGE_SOURCES.mou]: 'mou',
  [KNOWLEDGE_SOURCES.work_item]: 'work',
  [KNOWLEDGE_SOURCES.work_update]: 'work',
  [KNOWLEDGE_SOURCES.crm_org]: 'org',
  [KNOWLEDGE_SOURCES.department_profile]: 'department',
};

function kindsUsed(sql: string, sources: Array<{ id: string; title: string; viewName?: string }>, answer: string): SourceKind[] {
  const kinds = new Set<SourceKind>();
  for (const [re, k] of VIEW_KIND) if (re.test(sql)) kinds.add(k);
  for (const s of sources) {
    if (!/^K\d+$/.test(s.id) || !answer.includes(`[${s.id}]`)) continue;
    const label = s.title.split(': ')[0];
    const k = LABEL_KIND[label] ?? (Object.entries(KNOWLEDGE_SOURCES).find(([, l]) => l === label)?.[0] as SourceKind | undefined);
    if (k) kinds.add(k);
  }
  // Báo cáo tóm tắt tuần cũng là "báo cáo tuần".
  if (kinds.has('weekly_summary')) kinds.add('weekly_report');
  return [...kinds];
}

export function grade(c: KnowledgeEvalCase, used: SourceKind[], answer: string) {
  const a = toSearchKey(answer);
  const sourceOk = c.sources.all ? c.sources.all.every((k) => used.includes(k)) : (c.sources.any ?? []).some((k) => used.includes(k));
  const missing = c.mustMention.filter((group) => !group.some((m) => a.includes(toSearchKey(m))));
  const leaked = (c.mustNotMention ?? []).filter((m) => a.includes(toSearchKey(m)));
  return { sourceOk, mentionOk: missing.length === 0, cleanOk: leaked.length === 0, missing, leaked };
}

async function main() {
  const onlyArg = process.argv.indexOf('--only');
  const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(',')) : null;
  const outArg = process.argv.indexOf('--out');
  const out = outArg > 0 ? process.argv[outArg + 1] : `chatbot-eval-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`;
  await getMetricEmbeddings().catch(() => undefined);

  const cases = KNOWLEDGE_EVAL_CASES.filter((c) => !only || only.has(c.id));
  const results = [];
  for (const c of cases) {
    let sql = '';
    let sources: Array<{ id: string; title: string; viewName?: string }> = [];
    const started = Date.now();
    const r = await runChatbotPipeline(
      { question: c.question, history: [], userId: 'eval', userRole: 'ADMIN', allowedViews: GENERAL_CHATBOT_VIEWS, contextPath: null, contextHint: '' },
      (ev, d) => {
        if (ev === 'sql') sql = (d as { sql: string }).sql;
        if (ev === 'sources') sources = [...sources, ...(d as { sources: typeof sources }).sources];
      },
    ).catch((e) => ({ answer: `LỖI: ${String(e)}`, totalTokens: 0 }));
    const used = kindsUsed(sql, sources, r.answer);
    const g = grade(c, used, r.answer);
    const pass = g.sourceOk && g.mentionOk && g.cleanOk;
    results.push({ ...c, used, sql, answer: r.answer, tokens: r.totalTokens, ms: Date.now() - started, ...g, pass });
    console.log(
      `${pass ? 'ĐẠT ' : 'TRƯỢT'} ${c.id.padEnd(24)} nguồn ${g.sourceOk ? '✓' : '✗'} [${used.join(',') || '—'}]  ý ${g.mentionOk ? '✓' : `✗ thiếu ${g.missing.map((m) => m[0]).join(' / ')}`}  ${g.cleanOk ? '' : `✗ lẫn ${g.leaked.join(', ')}`}`,
    );
  }
  const byGroup = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const e = byGroup.get(r.group) ?? { pass: 0, total: 0 };
    byGroup.set(r.group, { pass: e.pass + (r.pass ? 1 : 0), total: e.total + 1 });
  }
  console.log('\n' + [...byGroup].map(([g, e]) => `${g}: ${e.pass}/${e.total}`).join(' · ') + ` · TỔNG ${results.filter((r) => r.pass).length}/${results.length}`);
  writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(`Chi tiết: ${out}`);
  process.exit(0);
}

main();
