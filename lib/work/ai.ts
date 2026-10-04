/**
 * B2: AI gợi ý các bước thực hiện và đánh giá tiến độ một công việc, dựa trên
 * nội dung chỉ đạo, tính chất, lưu ý Phòng HC ghi và lịch sử cập nhật.
 * Phòng ghi càng kỹ tính chất, lưu ý thì gợi ý càng sát.
 */
import { z } from 'zod';
import { callJson } from '@/lib/ai/zai';

const AI_MODEL = 'glm-5.2';
/** Đủ ngữ cảnh mà không phình prompt với việc có hàng trăm cập nhật. */
const MAX_UPDATES_IN_PROMPT = 15;

export const aiPlanSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        detail: z.string().max(1000).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        owner: z.string().max(200).optional(),
        done: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(12),
  assessment: z.object({
    level: z.enum(['on_track', 'at_risk', 'late']),
    summary: z.string().min(1).max(1000),
    nextAction: z.string().min(1).max(500),
  }),
});
export type AiPlan = z.infer<typeof aiPlanSchema>;

export interface AiWorkInput {
  title: string;
  description: string | null;
  kind: string;
  directedBy: string | null;
  directedAt: string | null;
  leadUnit: string | null;
  assignees: string[];
  dueDate: string | null;
  status: string;
  progressPercent: number | null;
  characteristics: string | null;
  notes: string | null;
  updates: Array<{ occurredAt: string; author: string | null; content: string; progressPercent: number | null }>;
  today: string;
}

export function buildWorkPrompt(input: AiWorkInput): string {
  const updates = input.updates
    .slice(-MAX_UPDATES_IN_PROMPT)
    .map((u) => `- ${u.occurredAt.slice(0, 10)}${u.author ? ` · ${u.author}` : ''}${u.progressPercent != null ? ` · ${u.progressPercent}%` : ''}: ${u.content}`)
    .join('\n');
  return [
    'Bạn là thư ký điều phối của Phòng Hành chính, Bệnh viện Đại học Y Dược TP.HCM.',
    'Nhiệm vụ: lập các bước thực hiện cho một công việc và đánh giá tiến độ hiện tại.',
    '',
    `Hôm nay: ${input.today}`,
    `Loại: ${input.kind === 'DIRECTIVE' ? 'Chỉ đạo của Ban Giám đốc' : input.kind === 'PLAN' ? 'Việc theo kế hoạch' : 'Khác'}`,
    `Tên công việc: ${input.title}`,
    input.description ? `Nội dung chỉ đạo: ${input.description}` : '',
    input.directedBy ? `Người chỉ đạo: ${input.directedBy}${input.directedAt ? ` (ngày ${input.directedAt})` : ''}` : '',
    input.leadUnit ? `Đơn vị chủ trì: ${input.leadUnit}` : '',
    input.assignees.length ? `Người thực hiện: ${input.assignees.join(', ')}` : '',
    `Hạn chót: ${input.dueDate ?? 'chưa có'}`,
    `Trạng thái: ${input.status}${input.progressPercent != null ? `, ${input.progressPercent}%` : ''}`,
    input.characteristics ? `Tính chất công việc (Phòng HC ghi): ${input.characteristics}` : '',
    input.notes ? `Lưu ý (Phòng HC ghi): ${input.notes}` : '',
    updates ? `Các lần cập nhật gần nhất:\n${updates}` : 'Chưa có cập nhật nào.',
    '',
    'Yêu cầu:',
    '- 3 đến 8 bước cụ thể, theo thứ tự làm; bước nào đã làm (theo cập nhật) thì done=true.',
    '- dueDate (YYYY-MM-DD) chỉ ghi khi suy ra được từ hạn chót, không bịa mốc ngoài hạn chót.',
    '- assessment.level: on_track (kịp hạn), at_risk (có nguy cơ trễ hoặc lâu không cập nhật), late (đã quá hạn mà chưa xong).',
    '- assessment.summary: 1–3 câu, nêu căn cứ (hạn chót, % tiến độ, lần cập nhật gần nhất).',
    '- assessment.nextAction: một việc nên làm ngay, cụ thể người/đơn vị.',
    '- Chỉ dựa vào thông tin trên, không bịa tên người, số liệu. Viết tiếng Việt.',
    '',
    'Trả về JSON đúng dạng: {"steps":[{"title":"","detail":"","dueDate":"","owner":"","done":false}],' +
      '"assessment":{"level":"on_track","summary":"","nextAction":""}}',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** Model hay trả "" cho trường không có — coi như không ghi. */
function dropEmptyStrings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropEmptyStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => [k, dropEmptyStrings(v)]),
    );
  }
  return value;
}

export async function suggestWorkPlan(input: AiWorkInput): Promise<{ plan: AiPlan; tokens: number }> {
  const result = await callJson<unknown>(buildWorkPrompt(input), { model: AI_MODEL, maxTokens: 2500, temperature: 0.2 });
  const plan = aiPlanSchema.parse(dropEmptyStrings(result.data));
  return { plan, tokens: result.usage.totalTokens };
}
