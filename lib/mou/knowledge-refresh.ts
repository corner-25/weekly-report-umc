/**
 * Sau mỗi lần sửa MOU (thông tin, khía cạnh, tiến độ, văn bản, đánh giá), cập
 * nhật lại phần MOU trong kho tri thức chatbot — gom các lần sửa liền nhau thành
 * một lượt (đợi vài giây), chỉ nhúng lại đoạn thật sự đổi.
 */
import { prisma } from '@/lib/prisma';
import { syncKnowledge } from '@/lib/chatbot/knowledge/indexer';

const DEBOUNCE_MS = 5_000;
let timer: ReturnType<typeof setTimeout> | null = null;

export function refreshMouKnowledge(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncKnowledge(prisma, { groups: ['mou'] }).catch((err) => console.error('[mou] cập nhật kho tri thức lỗi:', err));
  }, DEBOUNCE_MS);
}
