/**
 * Tóm tắt lần đồng bộ gần nhất, để hiển thị ở chân trang.
 *
 * Dữ liệu vào hệ thống qua cron chạy hằng ngày. Người xem cần biết số liệu trên
 * màn hình đang cũ hay mới — nhất là khi một nguồn hỏng thì trang vẫn hiện số cũ
 * mà không có dấu hiệu gì.
 */
import { prisma } from '@/lib/prisma';

export interface LastSyncSummary {
  /** Nhãn đã định dạng sẵn cho người đọc, ví dụ "hôm nay 07:15". */
  label: string;
  finishedAt: Date;
}

/** Khoảng thời gian coi là "vừa xong", tính bằng phút. */
const JUST_NOW_MINUTES = 5;

function formatRelative(when: Date): string {
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - when.getTime()) / 60_000);

  if (diffMinutes < JUST_NOW_MINUTES) return 'vừa xong';

  const time = when.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sameDay = when.toDateString() === now.toDateString();
  if (sameDay) return `hôm nay ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (when.toDateString() === yesterday.toDateString()) return `hôm qua ${time}`;

  return `${when.toLocaleDateString('vi-VN')} ${time}`;
}

export async function getLastSyncSummary(): Promise<LastSyncSummary | null> {
  try {
    const run = await prisma.syncRun.findFirst({
      where: { status: 'SUCCESS', finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    });

    if (!run?.finishedAt) return null;
    return { label: formatRelative(run.finishedAt), finishedAt: run.finishedAt };
  } catch {
    // Chân trang không đáng làm sập cả trang khi database trục trặc.
    return null;
  }
}
