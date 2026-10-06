import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { assessMou, extractMou } from '@/lib/mou/ai-run';
import { refreshMouKnowledge } from '@/lib/mou/knowledge-refresh';

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/**
 * AI đọc lại văn bản đã có chữ (OCR chạy ở máy Phòng HC) và đánh giá lại triển
 * khai theo dữ liệu mới nhất. Văn bản chưa OCR thì chỉ đánh giá.
 */
export const POST = handle(async (_request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const exists = await prisma.mOU.count({ where: { id, deletedAt: null } });
  if (!exists) throw new HttpError(404, 'Không tìm thấy MOU');
  const extracted = await extractMou(prisma, id);
  const assessed = await assessMou(prisma, id);
  // Gọi sau khi AI xong (mất ~1 phút), không phải đầu hàm như các route sửa nhanh.
  refreshMouKnowledge();
  return NextResponse.json({ extracted: extracted.message, assessed: assessed.message, tokens: extracted.tokens + assessed.tokens });
});
