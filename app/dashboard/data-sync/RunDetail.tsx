'use client';

import { useEffect, useState } from 'react';
import { formatDuration, formatTime, statusLabel, statusStyle } from './format';
import type { SyncLogRow, SyncRunRow } from './types';

const LEVEL_STYLES: Record<string, string> = {
  error: 'text-rose-700 bg-rose-50',
  warn: 'text-amber-800 bg-amber-50',
  info: 'text-slate-600 bg-slate-50',
};

interface RunDetailData {
  run: SyncRunRow & { rowsRead: number };
  logs: SyncLogRow[];
}

/** Chi tiết một lần chạy: thông số và toàn bộ log, để truy nguyên khi hỏng. */
export function RunDetail({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [data, setData] = useState<RunDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/sync-admin/runs/${runId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Không tải được chi tiết (HTTP ${res.status})`);
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi không xác định');
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  // Đóng bằng phím Esc — thao tác quen thuộc với hộp thoại.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết lần chạy đồng bộ"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Chi tiết lần chạy</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[calc(85vh-3rem)] overflow-y-auto px-5 py-4">
          {error && <p className="text-sm text-rose-700">{error}</p>}
          {!data && !error && <p className="text-sm text-slate-400">Đang tải…</p>}

          {data && (
            <>
              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <Field label="Nguồn" value={data.run.sourceId} />
                <Field
                  label="Trạng thái"
                  value={
                    <span
                      className={`rounded-md border px-2 py-0.5 font-medium ${statusStyle(data.run.status)}`}
                    >
                      {statusLabel(data.run.status)}
                    </span>
                  }
                />
                <Field label="Kích hoạt" value={data.run.trigger === 'cron' ? 'Tự động' : 'Thủ công'} />
                <Field
                  label="Thời gian"
                  value={formatDuration(data.run.startedAt, data.run.finishedAt)}
                />
                <Field label="Bắt đầu" value={formatTime(data.run.startedAt)} />
                <Field label="Đọc" value={data.run.rowsRead.toLocaleString('vi-VN')} />
                <Field label="Ghi" value={data.run.rowsUpserted.toLocaleString('vi-VN')} />
                <Field label="Bỏ qua" value={data.run.rowsSkipped.toLocaleString('vi-VN')} />
              </dl>

              {data.run.errorMessage && (
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                  {data.run.errorMessage}
                </pre>
              )}

              <h3 className="mt-5 text-xs font-semibold text-slate-700">
                Nhật ký ({data.logs.length})
              </h3>
              <ul className="mt-2 space-y-1.5">
                {data.logs.map((log) => (
                  <li
                    key={log.id}
                    className={`rounded-lg px-3 py-2 text-xs ${LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info}`}
                  >
                    <p>{log.message}</p>
                    {log.context != null && (
                      <pre className="mt-1.5 overflow-x-auto text-[11px] opacity-70">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
                {data.logs.length === 0 && (
                  <li className="text-xs text-slate-400">Không có dòng nhật ký nào.</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  );
}
