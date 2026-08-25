import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { deepseekComplete } from './deepseek';

export const createEventPayloadSchema = z.object({
  name: z.string().trim().min(1).max(300),
  date: z.string().datetime(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  description: z.string().max(5000).nullable(),
  meetingRoomId: z.string().nullable(),
  eventType: z.enum(['ORGANIZED', 'COLLABORATED']),
});

export const addChecklistPayloadSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).nullable(),
});

export const createWeekDraftPayloadSchema = z.object({
  weekNumber: z.number().int().min(1).max(53),
  year: z.number().int().min(2000).max(2200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const extractionSchema = z.object({
  ready: z.boolean(),
  missing: z.array(z.string()).default([]),
  payload: createEventPayloadSchema.partial().nullable(),
});

export function looksLikeCreateEventRequest(question: string) {
  if (/\b(ai|người nào)\s+(?:đã\s+)?tạo[\s\S]{0,40}(sự kiện|cuộc họp)/i.test(question)) return false;
  return /(tạo|thêm|lên lịch|đặt lịch)[\s\S]{0,80}(sự kiện|cuộc họp|hội nghị)/i.test(question);
}

export function looksLikeAddChecklistRequest(question: string) {
  return /(thêm|tạo)[\s\S]{0,40}(checklist|việc chuẩn bị|hạng mục chuẩn bị)/i.test(question);
}

export function looksLikeCreateWeekDraftRequest(question: string) {
  return /(tạo|thêm|khởi tạo)[\s\S]{0,50}(báo cáo tuần|tuần báo cáo)[\s\S]{0,30}(nháp|mới)?/i.test(question);
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error('Không đọc được đề xuất hành động');
  return JSON.parse(candidate);
}

export async function prepareCreateEventProposal(question: string, userId: string) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' }).format(new Date());
  const result = await deepseekComplete([
    {
      role: 'system',
      content:
        `Trích xuất yêu cầu tạo sự kiện bệnh viện. Hôm nay tại Việt Nam là ${today}. ` +
        'Chỉ trả JSON: {"ready":boolean,"missing":string[],"payload":{"name":string,"date":ISO8601,"time":"HH:mm"|null,"description":string|null,"meetingRoomId":null,"eventType":"ORGANIZED"|"COLLABORATED"}|null}. ' +
        'Cần tối thiểu tên và ngày. Không tự bịa thông tin còn thiếu. meetingRoomId luôn null vì tên phòng cần được đối chiếu riêng.',
    },
    { role: 'user', content: question },
  ], { maxTokens: 400, temperature: 0 });

  const extracted = extractionSchema.parse(extractJson(result.content));
  if (!extracted.ready || !extracted.payload) return { ready: false as const, missing: extracted.missing, tokens: result.usage.total_tokens };
  const payload = createEventPayloadSchema.parse(extracted.payload);
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  const proposal = await prisma.chatbotActionProposal.create({
    data: {
      userId,
      actionType: 'CREATE_HOSPITAL_EVENT',
      title: `Tạo sự kiện “${payload.name}”`,
      description: `Ngày ${new Date(payload.date).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}${payload.time ? ` lúc ${payload.time}` : ''}. Trạng thái ban đầu: chưa xác nhận.`,
      payload,
      expiresAt,
    },
    select: { id: true, actionType: true, title: true, description: true, expiresAt: true },
  });
  return { ready: true as const, proposal, tokens: result.usage.total_tokens };
}

export async function prepareAddChecklistProposal(question: string, userId: string, contextPath: string | null) {
  const eventId = contextPath?.match(/^\/dashboard\/hospital-events\/([^/]+)$/)?.[1];
  if (!eventId) return { ready: false as const, missing: ['hãy mở trang chi tiết sự kiện cần thêm checklist'], tokens: 0 };
  const result = await deepseekComplete([
    { role: 'system', content: 'Trích xuất một mục checklist sự kiện. Chỉ trả JSON {"title":string,"description":string|null}. Không bịa nội dung không được yêu cầu.' },
    { role: 'user', content: question },
  ], { maxTokens: 250, temperature: 0 });
  const extracted = z.object({ title: z.string(), description: z.string().nullable() }).parse(extractJson(result.content));
  const payload = addChecklistPayloadSchema.parse({ eventId, ...extracted });
  const proposal = await prisma.chatbotActionProposal.create({ data: { userId, actionType: 'ADD_EVENT_CHECKLIST_ITEM', title: `Thêm checklist “${payload.title}”`, description: payload.description || 'Thêm mục chuẩn bị vào sự kiện đang mở.', payload, expiresAt: new Date(Date.now() + 10 * 60_000) }, select: { id: true, actionType: true, title: true, description: true, expiresAt: true } });
  return { ready: true as const, proposal, tokens: result.usage.total_tokens };
}

export async function prepareCreateWeekDraftProposal(question: string, userId: string) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' }).format(new Date());
  const result = await deepseekComplete([
    { role: 'system', content: `Hôm nay là ${today}. Trích xuất tuần ISO và năm; tính khoảng Thứ Hai-Chủ Nhật. Chỉ trả JSON {"weekNumber":number,"year":number,"startDate":ISO8601,"endDate":ISO8601}. Không tự chọn tuần nếu yêu cầu không nói rõ.` },
    { role: 'user', content: question },
  ], { maxTokens: 250, temperature: 0 });
  let payload;
  try { payload = createWeekDraftPayloadSchema.parse(extractJson(result.content)); }
  catch { return { ready: false as const, missing: ['số tuần và năm'], tokens: result.usage.total_tokens }; }
  const proposal = await prisma.chatbotActionProposal.create({ data: { userId, actionType: 'CREATE_WEEK_DRAFT', title: `Tạo báo cáo tuần ${payload.weekNumber}/${payload.year}`, description: 'Tạo báo cáo rỗng ở trạng thái nháp để người dùng tiếp tục hoàn thiện.', payload, expiresAt: new Date(Date.now() + 10 * 60_000) }, select: { id: true, actionType: true, title: true, description: true, expiresAt: true } });
  return { ready: true as const, proposal, tokens: result.usage.total_tokens };
}
