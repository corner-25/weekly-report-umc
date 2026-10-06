/**
 * Tìm trong kho tri thức theo hai đường rồi trộn kết quả:
 *  - Từ khoá không dấu, theo ranh giới từ — bắt chắc tên riêng ("Nguyễn Phước Lộc"),
 *    số hiệu văn bản, tên đơn vị. Cụm tên riêng trong câu hỏi được ưu tiên rất cao.
 *  - Ngữ nghĩa (vector) — bắt câu hỏi diễn đạt khác chữ trong văn bản.
 * Trộn bằng Reciprocal Rank Fusion.
 */
import { getPrismaRo } from '@/lib/prisma-ro';
import { toSearchKey } from '@/lib/crm/constants';
import { embeddingsAvailable, embedTexts } from '../embeddings';
import { KNOWLEDGE_SOURCES, type KnowledgeSource } from './collect';

export interface KnowledgeHit {
  id: string;
  source: KnowledgeSource;
  sourceLabel: string;
  title: string;
  snippet: string;
  department: string | null;
  organization: string | null;
  occurredOn: string | null;
  href: string | null;
  score: number;
}

/** Từ hỏi, từ nối — bỏ khi tìm theo từ khoá (đã bỏ dấu). */
const STOPWORDS = new Set(
  ('a ai anh bao bay benh bi biet boi cac cai can cho chua co cua cung da dang de den deu di do duoc gi gio hay hien hoi khi khong la lai lam len luc ma minh moi mot nam nao nay ne neu nhieu nhung nho o oi ra roi sao se sau so tai the thi thoi toi tren trong tu tuan ve vi viec vien voi vua xem xin chung ta biet hom nay ngay thang dong chi')
    .split(' '),
);
const RRF_K = 60;
const KEYWORD_LIMIT = 40;
const VECTOR_LIMIT = 20;
const SNIPPET_CHARS = 700;
/** Đoạn khớp cụm tên riêng được cộng điểm lớn — tên người, đơn vị là thứ hỏi chính xác nhất. */
const PHRASE_BONUS = 1;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cụm từ viết hoa liên tiếp (tên người, tên đơn vị) và cụm trong ngoặc kép. */
export function properPhrases(question: string): string[] {
  const phrases = new Set<string>();
  for (const m of question.matchAll(/["“”']([^"“”']{3,80})["“”']/g)) phrases.add(toSearchKey(m[1]));
  const words = question.split(/\s+/);
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 2) phrases.add(toSearchKey(run.join(' ')));
    run = [];
  };
  for (const w of words) {
    const clean = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (clean && /^\p{Lu}/u.test(clean)) run.push(clean);
    else flush();
  }
  flush();
  return [...phrases].filter((p) => p.length >= 5);
}

export function keywordTokens(question: string): string[] {
  return [...new Set(toSearchKey(question).split(/[^a-z0-9/.-]+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t)))];
}

function snippetOf(body: string, terms: string[]): string {
  const key = toSearchKey(body);
  const pos = terms.map((t) => key.indexOf(t)).filter((p) => p >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, pos - 200);
  const text = body.slice(start, start + SNIPPET_CHARS);
  return `${start > 0 ? '…' : ''}${text}${start + SNIPPET_CHARS < body.length ? '…' : ''}`;
}

interface Row {
  id: string;
  source: string;
  title: string;
  body: string;
  department: string | null;
  organization: string | null;
  occurred_on: Date | null;
  href: string | null;
}

export async function searchKnowledge(question: string, limit = 8): Promise<KnowledgeHit[]> {
  const db = getPrismaRo();
  const phrases = properPhrases(question);
  const tokens = keywordTokens(question);
  const ranks = new Map<string, { row: Row; score: number }>();
  const add = (row: Row, score: number) => {
    const cur = ranks.get(row.id);
    ranks.set(row.id, { row, score: (cur?.score ?? 0) + score });
  };

  const tasks: Array<Promise<void>> = [];
  if (tokens.length || phrases.length) {
    const patterns = [...phrases, ...tokens].map((t) => `\\m${escapeRe(t)}\\M`);
    const phraseExpr = phrases.map((_, i) => `(search_key ~ $${i + 1})::int`).join(' + ') || '0';
    const tokenExpr = tokens.map((_, i) => `(search_key ~ $${phrases.length + i + 1})::int`).join(' + ') || '0';
    // Câu nhiều từ khoá: đòi khớp ít nhất một nửa để không kéo về đoạn chỉ trùng một từ phổ biến.
    const minHits = phrases.length ? 0 : Math.max(1, Math.ceil(tokens.length / 2));
    const sql = `
      SELECT id, source, title, body, department, organization, occurred_on, href, (${phraseExpr}) AS phrase_hits, (${tokenExpr}) AS hits
      FROM knowledge_chunks
      WHERE (${phraseExpr}) > 0 OR (${tokenExpr}) >= ${minHits}
      ORDER BY phrase_hits DESC, hits DESC, occurred_on DESC NULLS LAST
      LIMIT ${KEYWORD_LIMIT}`;
    tasks.push(
      db.$queryRawUnsafe<Array<Row & { phrase_hits: number; hits: number }>>(sql, ...patterns).then((rows) => {
        rows.forEach((r, i) => add(r, 1 / (RRF_K + i) + (Number(r.phrase_hits) > 0 ? PHRASE_BONUS : 0)));
      }),
    );
  }

  if (embeddingsAvailable()) {
    tasks.push(
      (async () => {
        const { vectors } = await embedTexts([question]);
        const rows = await db.$queryRawUnsafe<Row[]>(
          `SELECT id, source, title, body, department, organization, occurred_on, href
           FROM knowledge_chunks WHERE embedding IS NOT NULL
           ORDER BY embedding <=> $1::vector LIMIT ${VECTOR_LIMIT}`,
          `[${vectors[0].join(',')}]`,
        );
        rows.forEach((r, i) => add(r, 1 / (RRF_K + i)));
      })().catch((err) => {
        // Nhúng lỗi thì vẫn còn kết quả từ khoá.
        console.warn('[chatbot] tìm theo nghĩa lỗi:', err instanceof Error ? err.message : err);
      }),
    );
  }
  await Promise.all(tasks);

  const terms = [...phrases, ...tokens];
  return [...ranks.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: row.id,
      source: row.source as KnowledgeSource,
      sourceLabel: KNOWLEDGE_SOURCES[row.source as KnowledgeSource] ?? row.source,
      title: row.title,
      snippet: snippetOf(row.body, terms),
      department: row.department,
      organization: row.organization,
      occurredOn: row.occurred_on ? row.occurred_on.toISOString().slice(0, 10) : null,
      href: row.href,
      score: Math.round(score * 1000) / 1000,
    }));
}
