/**
 * Chấm độ đúng của CÂU TRẢ LỜI chatbot (không chỉ view được chọn — việc đó là
 * prisma/eval-chatbot.ts). Chạy pipeline thật với từng câu trong
 * prisma/eval/chatbot-answer-cases.json, đối chiếu con số với đáp án lấy từ
 * nguồn chính thức.
 *
 *   npx tsx prisma/eval-chatbot-answers.ts                 # chấm, in câu sai
 *   npx tsx prisma/eval-chatbot-answers.ts --out kq.json   # lưu kèm SQL, câu trả lời
 *   npx tsx prisma/eval-chatbot-answers.ts --only dd-      # chỉ các câu có id bắt đầu bằng dd-
 *
 * Cần ZAI_API_KEY và DATABASE_URL_RO (chatbot chỉ đọc qua tài khoản read-only).
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { runChatbotPipeline } from '@/lib/chatbot/pipeline';
import { getMetricEmbeddings } from '@/lib/chatbot/embeddings';
import { GENERAL_CHATBOT_VIEWS } from '@/lib/chatbot/sql-guard';
import { answerHas } from '@/lib/chatbot/answer-score';

interface Case {
  id: string;
  question: string;
  expect: Array<number | string>;
  source: string;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const { cases } = JSON.parse(readFileSync(join(__dirname, 'eval/chatbot-answer-cases.json'), 'utf8')) as { cases: Case[] };
  const only = arg('--only');
  const selected = only ? cases.filter((c) => c.id.startsWith(only)) : cases;

  // Dựng sẵn kho gợi ý: lần build đầu mất vài chục giây, đừng tính vào câu đầu tiên.
  await getMetricEmbeddings().catch((e) => console.warn('Bỏ qua embedding:', String(e).slice(0, 120)));

  const results = [];
  for (const c of selected) {
    let sql = '';
    const startedAt = Date.now();
    const r = await runChatbotPipeline(
      {
        question: c.question, history: [], userId: 'eval', userRole: 'ADMIN',
        allowedViews: GENERAL_CHATBOT_VIEWS, contextPath: null, contextHint: '',
      },
      (event, data) => {
        if (event === 'sql') sql = (data as { sql: string }).sql;
      },
    ).catch((e: unknown) => ({ answer: `LỖI: ${String(e)}` }));
    const hits = c.expect.map((e) => answerHas(e, r.answer));
    const ok = hits.every(Boolean);
    results.push({ ...c, ok, hits, answer: r.answer, sql, ms: Date.now() - startedAt });
    console.info(`${ok ? '✓' : '✗'} ${c.id.padEnd(22)} ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  }

  const passed = results.filter((r) => r.ok).length;
  const avg = results.reduce((s, r) => s + r.ms, 0) / Math.max(results.length, 1) / 1000;
  console.info(`\nĐÚNG ${passed}/${results.length} · trung bình ${avg.toFixed(1)}s/câu`);
  for (const r of results.filter((x) => !x.ok)) {
    console.info(`\n✗ ${r.id}: ${r.question}\n   cần ${JSON.stringify(r.expect)} · khớp ${JSON.stringify(r.hits)}\n   SQL: ${r.sql.replace(/\s+/g, ' ').slice(0, 260)}\n   ĐÁP: ${r.answer.replace(/\s+/g, ' ').slice(0, 300)}`);
  }

  const out = arg('--out');
  if (out) writeFileSync(out, JSON.stringify(results, null, 1));
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
