'use client';

import { useState } from 'react';
import { formatTime, statusLabel, statusStyle, timeAgo } from './format';
import type { SyncRunRow, SyncSourceRow } from './types';

const KIND_LABELS: Record<string, string> = {
  ONEDRIVE_SHARE: 'OneDrive',
  GOOGLE_SHEETS: 'Google Sheets',
  GITHUB_JSON: 'GitHub',
  HTTP_API: 'API nội bộ',
};

/** Quá thời gian này mà chưa đồng bộ thành công thì coi là dữ liệu cũ. */
const STALE_HOURS = 36;

function isStale(lastSuccessAt: string | null): boolean {
  if (!lastSuccessAt) return true;
  return Date.now() - new Date(lastSuccessAt).getTime() > STALE_HOURS * 3600 * 1000;
}

export function SourceCard({
  source,
  lastRun,
  onChanged,
}: {
  source: SyncSourceRow;
  lastRun: SyncRunRow | null;
  onChanged: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = source.cronEnabled && isStale(source.lastSuccessAt);

  async function runNow(force: boolean) {
    setRunning(true);
    setError(null);
    try {
      const params = new URLSearchParams({ source: source.id });
      if (force) params.set('force', '1');

      const res = await fetch(`/api/cron/sync?${params}`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const result = data.results?.[0];
      if (result?.status === 'FAILED') {
        setError(result.errorMessage ?? 'Đồng bộ thất bại');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setRunning(false);
      onChanged();
    }
  }

  async function toggleCron() {
    setToggling(true);
    try {
      await fetch('/api/sync-admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id, cronEnabled: !source.cronEnabled }),
      });
    } finally {
      setToggling(false);
      onChanged();
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{source.name}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {KIND_LABELS[source.kind] ?? source.kind}
          </p>
        </div>
        {lastRun && (
          <span
            className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${statusStyle(lastRun.status)}`}
          >
            {statusLabel(lastRun.status)}
          </span>
        )}
      </header>

      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-slate-400">Thành công gần nhất</dt>
          <dd className={stale ? 'font-medium text-amber-700' : 'text-slate-600'}>
            {timeAgo(source.lastSuccessAt)}
          </dd>
        </div>
        {lastRun && (
          <div className="flex justify-between">
            <dt className="text-slate-400">Lần chạy cuối</dt>
            <dd className="text-slate-600">
              {formatTime(lastRun.startedAt)} · ghi {lastRun.rowsUpserted.toLocaleString('vi-VN')}
            </dd>
          </div>
        )}
      </dl>

      {stale && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Đã quá {STALE_HOURS} giờ chưa đồng bộ thành công — dữ liệu có thể chưa mới nhất.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runNow(false)}
          disabled={running}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          {running ? 'Đang chạy…' : 'Chạy ngay'}
        </button>
        <button
          type="button"
          onClick={() => runNow(true)}
          disabled={running}
          title="Chạy lại kể cả khi nguồn không thay đổi"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Buộc chạy lại
        </button>
        <button
          type="button"
          onClick={toggleCron}
          disabled={toggling}
          className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
            source.cronEnabled
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border border-slate-200 text-slate-400 hover:bg-slate-50'
          }`}
        >
          {source.cronEnabled ? 'Tự động: bật' : 'Tự động: tắt'}
        </button>
      </footer>
    </article>
  );
}
