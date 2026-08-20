/** Định dạng hiển thị dùng chung cho trang đồng bộ. */

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  SKIPPED: 'bg-slate-50 text-slate-500 border-slate-200',
  RUNNING: 'bg-sky-50 text-sky-700 border-sky-200',
};

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  SKIPPED: 'Không đổi',
  RUNNING: 'Đang chạy',
};

export function statusStyle(status: string): string {
  return STATUS_STYLES[status] ?? STATUS_STYLES.SKIPPED;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Khoảng thời gian từ mốc đã cho tới bây giờ, dạng "3 giờ trước". */
export function timeAgo(value: string | null): string {
  if (!value) return 'chưa chạy lần nào';

  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  return `${Math.floor(hours / 24)} ngày trước`;
}
