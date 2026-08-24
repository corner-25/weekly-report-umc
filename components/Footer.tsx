/**
 * Chân trang — nói rõ dữ liệu đang xem là của ai và cập nhật tới đâu.
 *
 * Ứng dụng trước đây không có footer nào; người dùng mở một màn hình đầy số liệu
 * mà không biết chúng được cập nhật lúc nào. Với hệ thống chạy đồng bộ tự động
 * hằng ngày, "dữ liệu tới bao giờ" là thông tin cần thấy ở mọi trang.
 */
import { getLastSyncSummary } from '@/lib/sync-summary';

export async function Footer() {
  const lastSync = await getLastSyncSummary();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white/60 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
          <p>
            <span className="font-medium text-slate-600">
              Quản lý tập trung — Phòng Hành chính
            </span>
            <span className="mx-2 text-slate-300">·</span>
            Bệnh viện Đại học Y Dược TP.HCM
          </p>

          <p className="tabular-nums">
            {lastSync ? (
              <>
                Đồng bộ gần nhất:{' '}
                <span className="text-slate-600">{lastSync.label}</span>
              </>
            ) : (
              <span className="text-slate-400">Chưa có lần đồng bộ nào</span>
            )}
            <span className="mx-2 text-slate-300">·</span>© {year}
          </p>
        </div>
      </div>
    </footer>
  );
}
