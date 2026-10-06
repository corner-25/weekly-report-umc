/**
 * Viết báo cáo tóm tắt hoạt động tuần: gom báo cáo các phòng và chỉ số đã trích
 * của tuần, tính phần số liệu (facts.ts), nhờ AI viết phần chữ theo từng nhóm
 * mảng (chạy song song), ghép theo mẫu rồi lưu bản nháp.
 */
import type { PrismaClient } from '@prisma/client';
import { callJson } from '@/lib/ai/zai';
import { AI_MODELS } from '@/lib/ai/models';
import { toSearchKey } from '@/lib/crm/constants';
import { bhytItem, healthCheckItem, trainingTable, transplantTable, type MetricRow } from './facts';
import { buildPlanPrompt, buildTopicsPrompt, type TaskInput, type TopicInput } from './prompt';
import {
  aiTopicOutputSchema,
  SUMMARY_SECTIONS,
  SUMMARY_TOPICS,
  summaryContentSchema,
  type SummaryContent,
  type SummaryItem,
  type TopicKey,
} from './types';

/** Mỗi nhóm một lần gọi AI — nhỏ để câu chữ kỹ, chạy song song cho nhanh. */
const TOPIC_GROUPS: TopicKey[][] = [
  ['kcb', 'dieu-duong', 'dao-tao', 'cntt'],
  ['hanh-chinh', 'phan-anh', 'to-chuc', 'phap-che', 'tai-chinh', 'bhyt'],
  ['chat-luong', 'toa-nha', 'vat-tu', 'dau-thau', 'ctxh', 'truyen-thong'],
];

const TOPIC_HINTS: Partial<Record<TopicKey, string>> = {
  kcb: 'không nhắc số ca ghép tạng, khám sức khỏe toàn dân, lượt và chi phí KCB BHYT — đã có bảng, dòng riêng; nêu việc chuyên môn nổi bật khác',
  'dao-tao': 'không lặp các con số đã có trong bảng đào tạo (số sinh viên, học viên, lớp, đề tài); nêu hội nghị, hội thảo, đoàn quốc tế, ký kết, sự kiện đào tạo',
  bhyt: 'không lặp số lượt và chi phí KCB BHYT (đã nêu ở mục Chuyên môn); nêu văn bản, chấn chỉnh, giám định, thanh quyết toán',
  'phan-anh': 'CHỈ viết nếu có phản ánh, kiến nghị, khiếu nại cụ thể của người bệnh/đường dây nóng trong tuần; không có thì để rỗng',
  'phap-che': 'nếu không có báo cáo riêng thì để rỗng',
};

const MAX_TOKENS = 3500;
const MS_PER_DAY = 86_400_000;
const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
/** Cột ngày tuần lưu nửa đêm (giờ VN hoặc UTC) — cộng 7 giờ rồi lấy ngày theo UTC. */
const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3_600_000);

export interface GenerateResult {
  content: SummaryContent;
  model: string;
  tokens: number;
}

async function loadWeek(db: PrismaClient, weekId: string) {
  const week = await db.week.findUniqueOrThrow({ where: { id: weekId } });
  const prev =
    week.weekNumber > 1
      ? await db.week.findUnique({ where: { weekNumber_year: { weekNumber: week.weekNumber - 1, year: week.year } } })
      : await db.week.findFirst({ where: { year: week.year - 1 }, orderBy: { weekNumber: 'desc' } });
  return { week, prev };
}

async function loadMetrics(db: PrismaClient, weekId: string | null): Promise<MetricRow[]> {
  if (!weekId) return [];
  const rows = await db.extractedMetric.findMany({
    where: { weekId, reviewStatus: { not: 'REJECTED' } },
    select: { metricCode: true, name: true, value: true, unit: true, period: true },
  });
  return rows.map((r) => ({ code: r.metricCode, name: r.name.trim(), value: r.value, unit: r.unit, period: r.period }));
}

/**
 * Báo cáo các phòng trong tuần: lấy từ dòng gốc của báo cáo tuần (task_thread_entries
 * — đủ mọi dòng, có kế hoạch tuần sau); tuần chưa có thì lấy bảng tiến độ nhiệm vụ.
 */
async function loadTasks(db: PrismaClient, weekId: string, year: number, weekNumber: number) {
  const byDept = new Map<string, TaskInput[]>();
  const add = (dept: string, task: TaskInput) => byDept.set(dept, [...(byDept.get(dept) ?? []), task]);

  const departments = new Map((await db.department.findMany({ select: { id: true, name: true } })).map((d) => [d.id, d.name]));
  const entries = await db.taskThreadEntry.findMany({
    where: { year, week: weekNumber },
    orderBy: [{ departmentId: 'asc' }, { sourceRow: 'asc' }],
    select: { departmentId: true, rawName: true, parentGroup: true, resultText: true, nextWeekPlan: true, progress: true },
  });
  for (const e of entries) {
    add(departments.get(e.departmentId) ?? 'Không rõ', {
      name: e.rawName.trim(),
      subject: e.parentGroup,
      result: e.resultText.trim(),
      nextWeekPlan: e.nextWeekPlan?.trim() || null,
      progress: e.progress,
    });
  }
  if (entries.length) return byDept;

  const rows = await db.weekTaskProgress.findMany({
    where: { weekId },
    orderBy: { orderNumber: 'asc' },
    select: {
      rawTaskName: true, subject: true, rawResultText: true, result: true, nextWeekPlan: true, progress: true,
      masterTask: { select: { name: true, department: { select: { name: true } } } },
    },
  });
  for (const r of rows) {
    add(r.masterTask.department.name, {
      name: (r.rawTaskName ?? r.masterTask.name).trim(),
      subject: r.subject,
      result: (r.rawResultText ?? r.result ?? '').trim(),
      nextWeekPlan: r.nextWeekPlan?.trim() || null,
      progress: r.progress,
    });
  }
  return byDept;
}

/** Đoạn Phòng HC đã chốt gần nhất cho từng mảng — làm mẫu văn phong. */
async function loadApprovedExamples(db: PrismaClient, year: number, weekNumber: number): Promise<Map<string, string>> {
  const last = await db.weeklySummary.findFirst({
    where: { status: 'FINAL', week: { OR: [{ year, weekNumber: { lt: weekNumber } }, { year: { lt: year } }] } },
    orderBy: [{ week: { year: 'desc' } }, { week: { weekNumber: 'desc' } }],
    select: { content: true },
  });
  const map = new Map<string, string>();
  const parsed = last ? summaryContentSchema.safeParse(last.content) : null;
  if (!parsed?.success) return map;
  for (const section of parsed.data.sections) {
    for (const item of section.items) {
      if (item.type === 'text' && item.origin && item.origin !== 'facts' && item.text) {
        map.set(item.origin, [item.text, ...item.subItems].join(' '));
      }
    }
  }
  return map;
}

function topicInputs(keys: TopicKey[], byDept: Map<string, TaskInput[]>, examples: Map<string, string>): TopicInput[] {
  const depts = [...byDept.entries()].map(([name, tasks]) => ({ name, key: toSearchKey(name), tasks: tasks.filter((t) => t.result) }));
  return keys.map((key) => {
    const topic = SUMMARY_TOPICS.find((t) => t.key === key)!;
    return {
      key,
      label: topic.label,
      hint: TOPIC_HINTS[key],
      approvedExample: examples.get(key) ?? null,
      departments: depts.filter((d) => (topic.sources as readonly string[]).some((s) => d.key.includes(s)) && d.tasks.length).map(({ name, tasks }) => ({ name, tasks })),
    };
  });
}

export async function generateWeeklySummary(db: PrismaClient, weekId: string, now = new Date()): Promise<GenerateResult> {
  const { week, prev } = await loadWeek(db, weekId);
  const [cur, prevMetrics, byDept, examples] = await Promise.all([
    loadMetrics(db, week.id),
    loadMetrics(db, prev?.id ?? null),
    loadTasks(db, week.id, week.year, week.weekNumber),
    loadApprovedExamples(db, week.year, week.weekNumber),
  ]);
  const start = vnDay(week.startDate);
  const end = vnDay(week.endDate);
  const nextStart = new Date(end.getTime() + MS_PER_DAY);
  const nextEnd = new Date(end.getTime() + 7 * MS_PER_DAY);
  const events = await db.hospitalEvent.findMany({
    where: { deletedAt: null, date: { gte: new Date(nextStart.getTime() - 7 * 3_600_000), lt: new Date(nextEnd.getTime() + MS_PER_DAY - 7 * 3_600_000) } },
    orderBy: { date: 'asc' },
    select: { name: true, date: true, time: true },
  });

  const model = AI_MODELS.summary;
  const topicCalls = TOPIC_GROUPS.map((keys) =>
    callJson<unknown>(buildTopicsPrompt(week.weekNumber, week.year, topicInputs(keys, byDept, examples)), { model, maxTokens: MAX_TOKENS, temperature: 0.1 }),
  );
  const planPrompt = buildPlanPrompt(week.weekNumber, week.year, {
    nextWeek: week.weekNumber + 1,
    plans: [...byDept.entries()].map(([department, tasks]) => ({
      department,
      items: [...new Set(tasks.map((t) => t.nextWeekPlan).filter((p): p is string => Boolean(p)))],
    })),
    events: events.map((e) => ({ date: `${dm(vnDay(e.date))}/${vnDay(e.date).getUTCFullYear()}`, time: e.time, name: e.name })),
  });
  // Thỉnh thoảng model trả danh sách rỗng dù có kế hoạch — hỏi lại một lần.
  const planCall = (async () => {
    const first = await callJson<unknown>(planPrompt, { model, maxTokens: 1500, temperature: 0.1 });
    const items = aiTopicOutputSchema.safeParse(first.data);
    if (items.success && items.data.ke_hoach?.length) return first;
    const second = await callJson<unknown>(planPrompt, { model, maxTokens: 1500, temperature: 0.3 });
    return { ...second, usage: { ...second.usage, totalTokens: second.usage.totalTokens + first.usage.totalTokens } };
  })();
  // Một nhóm lỗi (AI trả JSON hỏng, hết hạn mức) không làm hỏng cả báo cáo — ghi chú để viết lại.
  const settled = await Promise.allSettled([...topicCalls, planCall]);
  const failedGroups = settled.flatMap((r, i) => (r.status === 'rejected' ? [i] : []));
  const results = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));

  const written = new Map<string, { text: string; subItems: string[] }>();
  let plan: string[] = [];
  let tokens = 0;
  for (const r of results) {
    tokens += r.usage.totalTokens;
    const parsed = aiTopicOutputSchema.safeParse(r.data);
    if (!parsed.success) continue;
    for (const m of parsed.data.muc) {
      const text = m.noi_dung.trim();
      if (!text) continue;
      // Ý con mà AI lặp lại ý đã có trong đoạn chính thì bỏ.
      const inText = toSearchKey(text);
      const subItems = (m.y_con ?? []).map((s) => s.trim()).filter((s) => s && !inText.includes(toSearchKey(s).replace(/[.;]+$/, '')));
      written.set(m.key, { text, subItems });
    }
    if (parsed.data.ke_hoach?.length) plan = parsed.data.ke_hoach.map((s) => s.trim()).filter(Boolean);
  }

  const textItem = (key: TopicKey): SummaryItem[] => {
    const w = written.get(key);
    const topic = SUMMARY_TOPICS.find((t) => t.key === key)!;
    return w ? [{ type: 'text', label: topic.label, text: w.text, subItems: w.subItems, origin: key }] : [];
  };
  const asOf = dm(end);
  const prevWeekNo = prev?.weekNumber ?? week.weekNumber - 1;
  const facts = (item: SummaryItem | null): SummaryItem[] => (item ? [item] : []);

  const itemsBySection: Record<string, SummaryItem[]> = {
    'chuyen-mon': [
      ...textItem('kcb'),
      ...facts(transplantTable(cur, prevMetrics, week.weekNumber, asOf)),
      ...facts(bhytItem(cur, prevMetrics, prevWeekNo)),
      ...facts(healthCheckItem(cur)),
      ...textItem('dieu-duong'),
    ],
    'dao-tao': [...facts(trainingTable(cur, week.weekNumber)), ...textItem('dao-tao')],
    'quan-tri': (['hanh-chinh', 'phan-anh', 'to-chuc', 'phap-che', 'tai-chinh', 'bhyt', 'chat-luong', 'toa-nha', 'vat-tu', 'dau-thau', 'ctxh', 'truyen-thong'] as TopicKey[]).flatMap(textItem),
    cntt: textItem('cntt'),
  };

  const reported = new Set([...byDept.keys()].map((name) => toSearchKey(name)));
  const silent = SUMMARY_TOPICS.filter((t) => t.sources.length && t.key !== 'phan-anh' && !(t.sources as readonly string[]).some((s) => [...reported].some((r) => r.includes(s))));
  const notes = [
    ...failedGroups.map((i) =>
      i < TOPIC_GROUPS.length
        ? `AI chưa viết được: ${TOPIC_GROUPS[i].map((k) => SUMMARY_TOPICS.find((t) => t.key === k)!.label).join(', ')} — bấm Viết lại.`
        : 'AI chưa viết được mục Kế hoạch tuần sau — bấm Viết lại.',
    ),
    'Bảng số liệu khám, chữa bệnh Cơ sở 1 và số ca nặng xin về/tử vong lấy từ phụ lục — chưa có trong dữ liệu báo cáo tuần, cần bổ sung tay.',
    ...(silent.length ? [`Chưa có báo cáo tuần này của: ${silent.map((t) => t.label).join(', ')}.`] : []),
  ];

  const content: SummaryContent = {
    week: week.weekNumber,
    year: week.year,
    range: `${dm(start)}-${dm(end)}/${end.getUTCFullYear()}`,
    dateLine: `Ngày ${String(vnDay(now).getUTCDate()).padStart(2, '0')} tháng ${String(vnDay(now).getUTCMonth() + 1).padStart(2, '0')} năm ${vnDay(now).getUTCFullYear()}`,
    sections: SUMMARY_SECTIONS.map((s) => ({ key: s.key, heading: s.heading, items: itemsBySection[s.key] ?? [] })),
    plan,
    notes,
  };
  return { content: summaryContentSchema.parse(content), model, tokens };
}
