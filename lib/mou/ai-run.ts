/**
 * Chạy AI cho một MOU: trích khía cạnh từ văn bản ký (extractMou) và đánh giá
 * triển khai từng khía cạnh theo bằng chứng (assessMou). Dùng chung cho script
 * chạy hàng loạt và nút "AI đọc lại" trên giao diện.
 */
import type { ClauseType, Prisma, PrismaClient } from '@prisma/client';
import { callJson } from '@/lib/ai/zai';
import { AI_MODELS } from '@/lib/ai/models';
import { KNOWLEDGE_SOURCES, type KnowledgeSource } from '@/lib/chatbot/knowledge/collect';
import { buildExtractPrompt, parseExtraction, type Aspect, type MouExtraction } from './extract';
import { buildAssessPrompt, knowledgeEvidence, parseAssessment, type Assessment, type EvidenceSnippet } from './assess';

/** Đọc văn bản pháp lý, ít lượt gọi (vài chục MOU) — dùng model mạnh. */
const MODEL = process.env.ZAI_MODEL_MOU || AI_MODELS.summary;
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

export interface RunResult {
  ok: boolean;
  message: string;
  tokens: number;
}

export async function extractMou(db: PrismaClient, mouId: string): Promise<RunResult> {
  const mou = await db.mOU.findUniqueOrThrow({
    where: { id: mouId },
    select: {
      title: true, partnerName: true, cooperationField: true, signedDate: true, expiryDate: true, purpose: true,
      partnerCountry: true, keyTerms: true, scope: true,
      documents: { where: { ocrText: { not: null } }, select: { fileName: true, title: true, documentType: true, ocrText: true } },
    },
  });
  const docs = mou.documents.filter((d) => (d.ocrText ?? '').split(/\s+/).length > 30);
  if (!docs.length) return { ok: false, message: 'Chưa có văn bản đọc được chữ', tokens: 0 };

  const prompt = buildExtractPrompt({
    title: mou.title,
    partnerName: mou.partnerName,
    officeField: mou.cooperationField,
    officeSignedDate: day(mou.signedDate),
    officeExpiryDate: day(mou.expiryDate),
    officeDescription: mou.purpose,
    docs: docs.map((d) => ({ fileName: d.fileName ?? d.title, documentType: d.documentType, text: d.ocrText! })),
  });
  const { data, usage } = await callJson<unknown>(prompt, { model: MODEL, maxTokens: 8000, temperature: 0.1 });
  const ex = parseExtraction(data);
  const trusted = ex.confidence !== 'low';

  await db.$transaction(async (tx) => {
    await tx.mOU.update({
      where: { id: mouId },
      data: {
        extraction: ex as unknown as Prisma.InputJsonValue,
        extractedAt: new Date(),
        ...(trusted && !mou.expiryDate && ex.expiryDate ? { expiryDate: toDate(ex.expiryDate) } : {}),
        ...(trusted && ex.partnerCountry && (!mou.partnerCountry || mou.partnerCountry === 'Nước ngoài') ? { partnerCountry: ex.partnerCountry } : {}),
        ...(!mou.keyTerms ? { keyTerms: keyTermsOf(ex) } : {}),
        ...(!mou.scope && ex.aspects.length ? { scope: ex.aspects.map((a) => `- ${a.title}`).join('\n') } : {}),
      },
    });
    // Khía cạnh do AI trích thì thay mới; hạng mục Phòng HC tự thêm giữ nguyên.
    await tx.mOUClause.deleteMany({ where: { mouId, aiGenerated: true } });
    const manual = await tx.mOUClause.count({ where: { mouId } });
    await tx.mOUClause.createMany({
      data: ex.aspects.map((a, i) => ({
        mouId,
        orderNumber: manual + i + 1,
        clauseType: a.type as ClauseType,
        title: a.title,
        content: [a.content, ...a.commitments.map((c) => `• ${c}`)].join('\n'),
        responsibleParty: a.responsibleParty,
        deadline: toDate(a.deadline),
        notes: a.deliverable,
        aiGenerated: true,
      })),
    });
  });
  return { ok: true, message: `${ex.aspects.length} khía cạnh · độ tin cậy ${ex.confidence}`, tokens: usage.totalTokens };
}

function keyTermsOf(ex: MouExtraction): string | null {
  const parts = [
    ex.termText && `Thời hạn: ${ex.termText}`,
    ex.financialTerms && `Tài chính: ${ex.financialTerms}`,
    ex.terminationTerms && `Chấm dứt: ${ex.terminationTerms}`,
    ex.followUp && `Việc tiếp theo: ${ex.followUp}`,
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : null;
}

export interface StoredEvidence {
  date: string | null;
  source: string;
  title: string;
  summary: string;
  href: string | null;
}

export interface StoredAssessment extends Omit<Assessment, 'aspects' | 'otherActivities'> {
  otherActivities: StoredEvidence[];
  evidenceFound: number;
  model: string;
  at: string;
}

const sourceLabel = (s: string) => (s === 'office' ? 'Nhật ký office' : s === 'activity' ? 'Hoạt động MOU' : KNOWLEDGE_SOURCES[s as KnowledgeSource] ?? s);

export async function assessMou(db: PrismaClient, mouId: string, now = new Date()): Promise<RunResult> {
  const mou = await db.mOU.findUniqueOrThrow({
    where: { id: mouId },
    select: {
      title: true, partnerName: true, signedDate: true, expiryDate: true, externalStatus: true, progressPercent: true, purpose: true,
      department: { select: { name: true } },
      crmOrganization: { select: { name: true, aliases: true } },
      clauses: { orderBy: { orderNumber: 'asc' }, select: { id: true, clauseType: true, title: true, content: true, responsibleParty: true, notes: true, deadline: true, aiGenerated: true } },
      progressLogs: { orderBy: { date: 'asc' }, select: { date: true, content: true, updatedBy: true } },
      activities: { orderBy: { startDate: 'asc' }, select: { startDate: true, title: true, status: true, result: true } },
    },
  });

  const knowledge = await knowledgeEvidence(db, mou.partnerName, 24, mou.crmOrganization ? [mou.crmOrganization.name, ...mou.crmOrganization.aliases] : []);
  const evidence: EvidenceSnippet[] = [
    ...mou.progressLogs.map((l) => ({ date: day(l.date), source: 'office', title: 'Nhật ký tiến độ', text: l.content, href: null })),
    ...knowledge,
  ].map((e, i) => ({ ...e, ref: `E${i + 1}` }));

  const aspects: Aspect[] = mou.clauses.map((c) => ({
    type: c.clauseType,
    title: c.title,
    content: c.content ?? '',
    responsibleParty: c.responsibleParty,
    commitments: [],
    deliverable: c.notes,
    deadline: day(c.deadline),
  }));
  if (!aspects.length && mou.purpose) {
    aspects.push({ type: 'OTHER', title: 'Nội dung hợp tác chung', content: mou.purpose, responsibleParty: 'BOTH', commitments: [], deliverable: null, deadline: null });
  }

  const prompt = buildAssessPrompt({
    partnerName: mou.partnerName,
    title: mou.title,
    signedDate: day(mou.signedDate),
    expiryDate: day(mou.expiryDate),
    today: day(now)!,
    department: mou.department?.name ?? null,
    officeStatus: mou.externalStatus,
    officeProgress: mou.progressPercent,
    aspects,
    logs: mou.progressLogs.map((l) => ({ date: day(l.date)!, content: l.content, author: l.updatedBy })),
    activities: mou.activities.map((a) => ({ date: day(a.startDate), title: a.title, status: a.status, result: a.result })),
    evidence,
  });
  const { data, usage } = await callJson<unknown>(prompt, { model: MODEL, maxTokens: 6000, temperature: 0.1 });
  const result = parseAssessment(data);

  const byRef = new Map(evidence.map((e) => [e.ref, e]));
  const resolve = (items: Array<{ ref: string; summary: string }>): StoredEvidence[] =>
    items.flatMap((it) => {
      const e = byRef.get(it.ref.replace(/[[\]]/g, ''));
      return e ? [{ date: e.date, source: sourceLabel(e.source), title: e.title, summary: it.summary, href: e.href }] : [];
    });

  const stored: StoredAssessment = {
    lastActivityDate: result.lastActivityDate,
    implementationLevel: Math.round(result.implementationLevel),
    verdict: result.verdict,
    rationale: result.rationale,
    risks: result.risks,
    recommendations: result.recommendations,
    otherActivities: resolve(result.otherActivities),
    evidenceFound: evidence.length,
    model: MODEL,
    at: now.toISOString(),
  };

  await db.$transaction(async (tx) => {
    for (const a of result.aspects) {
      const clause = mou.clauses[a.index - 1];
      if (!clause) continue;
      const items = resolve(a.evidence);
      await tx.mOUClause.update({
        where: { id: clause.id },
        data: {
          evidence: { items, gap: a.gap } as unknown as Prisma.InputJsonValue,
          // Hạng mục Phòng HC tự nhập thì giữ trạng thái họ ghi, chỉ gắn bằng chứng.
          ...(clause.aiGenerated
            ? { clauseStatus: a.status, progress: Math.round(a.progress), isCompleted: a.status === 'COMPLETED' }
            : {}),
        },
      });
    }
    await tx.mOU.update({ where: { id: mouId }, data: { assessment: stored as unknown as Prisma.InputJsonValue, assessedAt: now } });
  });
  return { ok: true, message: `${stored.verdict} · ${stored.implementationLevel}% · ${evidence.length} đoạn bằng chứng`, tokens: usage.totalTokens };
}
