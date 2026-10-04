'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { FileUp } from 'lucide-react';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { formatDateTime } from '@/components/crm/format';
import { ErrorBanner, SECONDARY_BTN, SectionCard } from '@/components/crm/ui';
import type { WorkImportResult, WorkOverviewDTO } from './types';

/** Lần nạp gần nhất và nút tải file JSON do script cào xuất ra. */
export function ImportCard({ lastImport, onImported }: { lastImport: WorkOverviewDTO['lastImport']; onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<WorkImportResult | null>(null);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      setResult(await crmFetch<WorkImportResult>('/api/work/import', { method: 'POST', body: form }));
      onImported();
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'Không nạp được file.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Nạp dữ liệu từ phân hệ Quản lý công việc"
      action={
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className={SECONDARY_BTN}>
          <FileUp className="h-4 w-4" aria-hidden="true" /> {busy ? 'Đang nạp...' : 'Tải file cào (.json)'}
        </button>
      }
    >
      <input ref={input} type="file" accept="application/json,.json" className="sr-only" onChange={upload} />
      <ErrorBanner message={error} />
      {result && (
        <p role="status" className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Đã nạp {result.itemsSeen} việc: {result.itemsCreated} việc mới, {result.itemsChanged} việc thay đổi, {result.updatesAdded} cập nhật mới
          {result.problems.length > 0 && ` · ${result.problems.length} dòng bị bỏ qua (${result.problems[0].message})`}.
        </p>
      )}
      {lastImport ? (
        <p className="text-sm text-slate-600">
          Lần nạp gần nhất: <b className="font-semibold">{formatDateTime(lastImport.importedAt)}</b>
          {lastImport.scrapedAt && <> (cào lúc {formatDateTime(lastImport.scrapedAt)})</>} · {lastImport.itemsSeen} việc,{' '}
          {lastImport.updatesAdded} cập nhật mới
          {lastImport.problemCount > 0 && <span className="text-amber-700"> · {lastImport.problemCount} dòng lỗi</span>}
        </p>
      ) : (
        <p className="text-sm text-slate-500">Chưa nạp lần nào. Chạy script cào trong mạng bệnh viện rồi tải file kết quả lên đây, hoặc để script tự gửi bằng mã nạp dữ liệu.</p>
      )}
    </SectionCard>
  );
}
