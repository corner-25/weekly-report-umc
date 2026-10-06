/**
 * Đồng bộ kho tri thức: gom đoạn văn (collect.ts), so mã băm nội dung với bản đã
 * lưu, chỉ ghi và nhúng vector lại đoạn mới/đổi, xoá đoạn không còn. Chạy lại bao
 * nhiêu lần cũng được — lần sau chỉ tốn tiền nhúng phần thay đổi.
 */
import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { toSearchKey } from '@/lib/crm/constants';
import { embeddingsAvailable, embedTexts } from '../embeddings';
import { GROUP_SOURCES, collectKnowledge, type KnowledgeDoc, type KnowledgeGroup } from './collect';

/** Số đoạn nhúng mỗi lượt (embedTexts tự chia lô nhỏ theo nhà cung cấp). */
const EMBED_BATCH = 100;
const WRITE_BATCH = 200;
/** Phần văn bản đưa đi nhúng: tiêu đề + thân, cắt bớt cho vừa giới hạn model. */
const EMBED_CHARS = 2000;

export interface IndexStats {
  total: number;
  changed: number;
  removed: number;
  embedded: number;
  embeddingModel: string | null;
  embedError: string | null;
}

const hashOf = (d: KnowledgeDoc) =>
  createHash('sha1').update([d.title, d.body, d.department ?? '', d.organization ?? '', d.href ?? '', d.occurredOn?.toISOString() ?? ''].join('\u0001')).digest('hex');

export async function syncKnowledge(
  db: PrismaClient,
  options: { log?: (msg: string) => void; embed?: boolean; groups?: KnowledgeGroup[] } = {},
): Promise<IndexStats> {
  const log = options.log ?? (() => {});
  const docs = await collectKnowledge(db, options.groups);
  // Đồng bộ một phần (vd chỉ MOU sau khi sửa): chỉ so và xoá đoạn của đúng các nguồn đó.
  const sources = options.groups ? options.groups.flatMap((g) => GROUP_SOURCES[g]) : null;
  const existing = new Map(
    (sources
      ? await db.$queryRaw<Array<{ id: string; content_hash: string; has_vec: boolean }>>`
          SELECT id, content_hash, embedding IS NOT NULL AS has_vec FROM knowledge_chunks WHERE source = ANY(${sources}::text[])`
      : await db.$queryRaw<Array<{ id: string; content_hash: string; has_vec: boolean }>>`
          SELECT id, content_hash, embedding IS NOT NULL AS has_vec FROM knowledge_chunks`
    ).map((r) => [r.id, r]),
  );

  const ids = new Set(docs.map((d) => d.id));
  const removed = [...existing.keys()].filter((id) => !ids.has(id));
  for (let i = 0; i < removed.length; i += WRITE_BATCH) {
    await db.$executeRaw`DELETE FROM knowledge_chunks WHERE id = ANY(${removed.slice(i, i + WRITE_BATCH)})`;
  }

  const changed = docs.filter((d) => existing.get(d.id)?.content_hash !== hashOf(d));
  log(`Kho tri thức: ${docs.length} đoạn, ${changed.length} mới/đổi, ${removed.length} xoá`);
  // Ghi theo lô một câu lệnh (unnest mảng) — mỗi dòng một câu thì qua mạng chậm hàng chục lần.
  for (let i = 0; i < changed.length; i += WRITE_BATCH) {
    const b = changed.slice(i, i + WRITE_BATCH);
    const col = <T>(f: (d: KnowledgeDoc) => T) => b.map(f);
    await db.$executeRaw`
      INSERT INTO knowledge_chunks (id, source, ref_id, title, body, department, organization, occurred_on, year, week, href, search_key, content_hash, embedding, embedding_model, updated_at)
      SELECT t.id, t.source, t.ref_id, t.title, t.body, t.department, t.organization, t.occurred_on::date, t.year::int, t.week::int, t.href, t.search_key, t.content_hash, NULL, NULL, now()
      FROM unnest(
        ${col((d) => d.id)}::text[], ${col((d) => d.source)}::text[], ${col((d) => d.refId)}::text[], ${col((d) => d.title)}::text[], ${col((d) => d.body)}::text[],
        ${col((d) => d.department ?? null)}::text[], ${col((d) => d.organization ?? null)}::text[],
        ${col((d) => (d.occurredOn ? d.occurredOn.toISOString().slice(0, 10) : null))}::text[],
        ${col((d) => (d.year == null ? null : String(d.year)))}::text[], ${col((d) => (d.week == null ? null : String(d.week)))}::text[], ${col((d) => d.href ?? null)}::text[],
        ${col((d) => toSearchKey(d.title, d.body, d.department, d.organization))}::text[], ${col(hashOf)}::text[]
      ) AS t(id, source, ref_id, title, body, department, organization, occurred_on, year, week, href, search_key, content_hash)
      ON CONFLICT (id) DO UPDATE SET source = EXCLUDED.source, ref_id = EXCLUDED.ref_id, title = EXCLUDED.title, body = EXCLUDED.body,
        department = EXCLUDED.department, organization = EXCLUDED.organization, occurred_on = EXCLUDED.occurred_on, year = EXCLUDED.year,
        week = EXCLUDED.week, href = EXCLUDED.href, search_key = EXCLUDED.search_key, content_hash = EXCLUDED.content_hash,
        embedding = NULL, embedding_model = NULL, updated_at = now()`;
    if (i % (WRITE_BATCH * 10) === 0) log(`  đã ghi ${Math.min(i + WRITE_BATCH, changed.length)}/${changed.length}`);
  }

  const stats: IndexStats = { total: docs.length, changed: changed.length, removed: removed.length, embedded: 0, embeddingModel: null, embedError: null };
  if (options.embed === false || !embeddingsAvailable()) return stats;

  // Nhúng mọi đoạn chưa có vector (mới/đổi, hoặc lần trước nhúng lỗi giữa chừng).
  const pending = await db.$queryRaw<Array<{ id: string; title: string; body: string }>>`
    SELECT id, title, body FROM knowledge_chunks WHERE embedding IS NULL ORDER BY occurred_on DESC NULLS LAST`;
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    try {
      const { vectors, model } = await embedTexts(batch.map((r) => `${r.title}\n${r.body}`.slice(0, EMBED_CHARS)));
      await db.$executeRaw`
        UPDATE knowledge_chunks k SET embedding = t.vec::vector, embedding_model = ${model}
        FROM unnest(${batch.map((r) => r.id)}::text[], ${vectors.map((v) => `[${v.join(',')}]`)}::text[]) AS t(id, vec)
        WHERE k.id = t.id`;
      stats.embedded += batch.length;
      stats.embeddingModel = model;
      if ((i / EMBED_BATCH) % 10 === 0) log(`  đã nhúng ${stats.embedded}/${pending.length}`);
    } catch (err) {
      // Lỗi nhúng không làm hỏng kho: đoạn vẫn tìm được theo từ khoá, lần sau nhúng tiếp.
      stats.embedError = err instanceof Error ? err.message : String(err);
      log(`  lỗi nhúng, dừng lại: ${stats.embedError}`);
      break;
    }
  }
  return stats;
}
