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

export interface SearchOptions {
  /** Chỉ tìm trong các nguồn này (người dùng nói rõ "theo báo cáo tuần", "sổ tiếp đoàn"…). */
  sources?: readonly string[] | null;
  /** Chỉ tìm đoạn của các phòng ban này. */
  departments?: readonly string[] | null;
}

export async function searchKnowledge(question: string, limit = 8, options: SearchOptions = {}): Promise<KnowledgeHit[]> {
  const db = getPrismaRo();
  // Điều kiện lọc thêm vào sau các tham số mẫu tìm kiếm; $n đánh số tiếp.
  const filters: string[] = [];
  const filterArgs: unknown[] = [];
  const addFilter = (column: string, values: readonly string[] | null | undefined, base: number) => {
    if (!values?.length) return;
    filterArgs.push([...values]);
    filters.push(`${column} = ANY($${base + filterArgs.length}::text[])`);
  };
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
    filters.length = 0;
    filterArgs.length = 0;
    addFilter('source', options.sources, patterns.length);
    addFilter('department', options.departments, patterns.length);
    const extra = filters.length ? ` AND ${filters.join(' AND ')}` : '';
    const sql = `
      SELECT id, source, title, body, department, organization, occurred_on, href, (${phraseExpr}) AS phrase_hits, (${tokenExpr}) AS hits
      FROM knowledge_chunks
      WHERE ((${phraseExpr}) > 0 OR (${tokenExpr}) >= ${minHits})${extra}
      ORDER BY phrase_hits DESC, hits DESC, occurred_on DESC NULLS LAST
      LIMIT ${KEYWORD_LIMIT}`;
    tasks.push(
      db.$queryRawUnsafe<Array<Row & { phrase_hits: number; hits: number }>>(sql, ...patterns, ...filterArgs).then((rows) => {
        rows.forEach((r, i) => add(r, 1 / (RRF_K + i) + (Number(r.phrase_hits) > 0 ? PHRASE_BONUS : 0)));
      }),
    );
  }

  if (embeddingsAvailable()) {
    tasks.push(
      (async () => {
        const { vectors } = await embedTexts([question]);
        const vf: string[] = [];
        const vargs: unknown[] = [];
        if (options.sources?.length) { vargs.push([...options.sources]); vf.push(`source = ANY($${1 + vargs.length}::text[])`); }
        if (options.departments?.length) { vargs.push([...options.departments]); vf.push(`department = ANY($${1 + vargs.length}::text[])`); }
        const rows = await db.$queryRawUnsafe<Row[]>(
          `SELECT id, source, title, body, department, organization, occurred_on, href
           FROM knowledge_chunks WHERE embedding IS NOT NULL${vf.length ? ` AND ${vf.join(' AND ')}` : ''}
           ORDER BY embedding <=> $1::vector LIMIT ${VECTOR_LIMIT}`,
          `[${vectors[0].join(',')}]`,
          ...vargs,
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

const PER_SOURCE_CAP = 4;
let deptCache: { at: number; names: string[] } | null = null;
const DEPT_CACHE_MS = 10 * 60_000;

/** Tên phòng ban có trong kho tri thức (đọc qua quyền chỉ đọc của chatbot), lưu đệm 10 phút. */
export async function knownDepartments(): Promise<string[]> {
  if (deptCache && Date.now() - deptCache.at < DEPT_CACHE_MS) return deptCache.names;
  const rows = await getPrismaRo().$queryRawUnsafe<Array<{ department: string }>>(
    `SELECT DISTINCT department FROM knowledge_chunks WHERE department IS NOT NULL`,
  );
  deptCache = { at: Date.now(), names: rows.map((r) => r.department) };
  return deptCache.names;
}

/**
 * Tìm tri thức theo phạm vi câu hỏi: hồ sơ của phòng được nhắc (gom mọi phân hệ),
 * đoạn của đúng phòng đó, rồi kết quả chung — trộn xen kẽ, mỗi nguồn tối đa vài đoạn
 * để câu trả lời có đủ các phân hệ thay vì toàn một loại.
 */
export async function gatherKnowledge(
  question: string,
  scope: { departments: string[]; sources: readonly string[] | null },
  limit = 10,
): Promise<KnowledgeHit[]> {
  const { departments, sources } = scope;
  const [general, inDept, profiles] = await Promise.all([
    searchKnowledge(question, limit, { sources }),
    departments.length ? searchKnowledge(question, limit, { departments, sources }) : Promise.resolve([]),
    departments.length && !sources ? profileHits(departments) : Promise.resolve([]),
  ]);
  const merged: KnowledgeHit[] = [];
  const seen = new Set<string>();
  const perSource = new Map<string, number>();
  const push = (h: KnowledgeHit) => {
    if (seen.has(h.id) || (perSource.get(h.source) ?? 0) >= PER_SOURCE_CAP) return;
    seen.add(h.id);
    perSource.set(h.source, (perSource.get(h.source) ?? 0) + 1);
    merged.push(h);
  };
  profiles.forEach(push);
  // Hỏi về một phòng: ưu tiên đoạn của phòng đó, xen với kết quả chung (đối tác, tên riêng).
  const lanes = departments.length ? [inDept, general] : [general];
  for (let i = 0; merged.length < limit && lanes.some((l) => i < l.length); i += 1) {
    for (const lane of lanes) if (lane[i]) push(lane[i]);
  }
  return merged.slice(0, limit);
}

async function profileHits(departments: string[]): Promise<KnowledgeHit[]> {
  const rows = await getPrismaRo().$queryRawUnsafe<Row[]>(
    `SELECT id, source, title, body, department, organization, occurred_on, href
     FROM knowledge_chunks WHERE source = 'department_profile' AND department = ANY($1::text[])`,
    departments,
  );
  return rows.map((row) => ({
    id: row.id,
    source: row.source as KnowledgeSource,
    sourceLabel: KNOWLEDGE_SOURCES[row.source as KnowledgeSource] ?? row.source,
    title: row.title,
    // Hồ sơ phòng là bản tóm tắt nhiều phân hệ — đưa trọn (đã giới hạn độ dài khi gom).
    snippet: row.body.slice(0, 2400),
    department: row.department,
    organization: row.organization,
    occurredOn: row.occurred_on ? row.occurred_on.toISOString().slice(0, 10) : null,
    href: row.href,
    score: 1,
  }));
}
