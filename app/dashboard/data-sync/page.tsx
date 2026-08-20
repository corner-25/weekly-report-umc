'use client';

import { useCallback, useEffect, useState } from 'react';
import { AiReportImportPanel } from './AiReportImportPanel';
import { HcUploadPanel } from './HcUploadPanel';
import { RunDetail } from './RunDetail';
import { SourceCard } from './SourceCard';
import { formatDuration, formatTime, statusLabel, statusStyle } from './format';
import type { SyncAdminData } from './types';

/**
 * Trang quản trị đồng bộ dữ liệu.
 *
 * Dữ liệu được lấy tự động hằng ngày lúc 07:00 (cron service trên Railway).
 * Trang này để xem trạng thái, chạy tay khi cần, và truy nguyên khi có lỗi.
 */
export default function DataSyncPage() {
  const [data, setData] = useState<SyncAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/sync-admin');
      if (!res.ok) throw new Error(`Không tải được dữ liệu (HTTP ${res.status})`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Đồng bộ dữ liệu</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Tự động chạy hằng ngày lúc 07:00. Chỉ nạp dữ liệu mới, không ghi đè số đã lưu.
          </p>
        </div>
        {data && <Stats stats={data.stats} />}
      </header>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Đang tải…</p>
      ) : data ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Nguồn dữ liệu</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  lastRun={data.recentRuns.find((r) => r.sourceId === source.id) ?? null}
                  onChanged={reload}
                />
              ))}
            </div>
          </section>

          {data.pending.length > 0 && <PendingWeeks pending={data.pending} />}

          <RecentRuns runs={data.recentRuns} onOpen={setOpenRunId} />
        </>
      ) : null}

      <section className="space-y-4 border-t border-slate-100 pt-8">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Nhập liệu thủ công</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Phương án dự phòng khi cần nạp gấp ngoài lịch
          </p>
        </div>
        <AiReportImportPanel />
        <HcUploadPanel />
      </section>

      {openRunId && <RunDetail runId={openRunId} onClose={() => setOpenRunId(null)} />}
    </div>
  );
}

function Stats({ stats }: { stats: SyncAdminData['stats'] }) {
  const items = [
    { label: 'Số liệu Phòng HC', value: stats.hcMetrics },
    { label: 'Chuyến xe', value: stats.fleetTrips },
    { label: 'Tuần chờ duyệt', value: stats.pendingCount },
  ];

  return (
    <dl className="flex gap-6">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-slate-400">{item.label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900">
            {item.value.toLocaleString('vi-VN')}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PendingWeeks({ pending }: { pending: SyncAdminData['pending'] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">
          Báo cáo bệnh viện chờ duyệt ({pending.length})
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Nội dung là văn bản tự do, cần AI trích xuất và người xác nhận trước khi ghi vào báo cáo tuần
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {pending.map((p) => (
          <span
            key={p.id}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900"
          >
            Tuần {p.week}/{p.year}
          </span>
        ))}
      </div>
    </section>
  );
}

function RecentRuns({
  runs,
  onOpen,
}: {
  runs: SyncAdminData['recentRuns'];
  onOpen: (id: string) => void;
}) {
  if (runs.length === 0) {
    return <p className="text-sm text-slate-400">Chưa có lần chạy nào.</p>;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">Lịch sử chạy</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nguồn</th>
              <th className="px-4 py-2.5 font-medium">Trạng thái</th>
              <th className="px-4 py-2.5 font-medium">Bắt đầu</th>
              <th className="px-4 py-2.5 text-right font-medium">Ghi</th>
              <th className="px-4 py-2.5 text-right font-medium">Bỏ qua</th>
              <th className="px-4 py-2.5 text-right font-medium">Thời gian</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-700">{run.sourceId}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${statusStyle(run.status)}`}
                  >
                    {statusLabel(run.status)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{formatTime(run.startedAt)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                  {run.rowsUpserted.toLocaleString('vi-VN')}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                  {run.rowsSkipped.toLocaleString('vi-VN')}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                  {formatDuration(run.startedAt, run.finishedAt)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onOpen(run.id)}
                    className="text-xs font-medium text-cyan-700 hover:underline"
                  >
                    Chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
