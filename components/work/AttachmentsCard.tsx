'use client';

/** File đính kèm của công việc trên office — cào về, nén PDF, lưu trong hệ thống. */
import { Download, ExternalLink, FileSpreadsheet, FileText, Paperclip } from 'lucide-react';
import { SectionCard } from '@/components/crm/ui';
import { formatDate } from '@/components/crm/format';
import type { WorkAttachmentDTO } from './types';

const KIND_LABEL: Record<string, string> = { TASK: 'File của việc', LOGTIME: 'Kèm báo cáo tiến độ', RESULT: 'Kết quả công việc', NOTES: 'Trong trao đổi' };
const KIND_ORDER = ['TASK', 'RESULT', 'LOGTIME', 'NOTES'];

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function AttachmentsCard({ attachments }: { attachments: WorkAttachmentDTO[] }) {
  if (!attachments.length) return null;
  return (
    <SectionCard
      title="File đính kèm"
      icon={<Paperclip className="h-4 w-4 text-cyan-600" aria-hidden="true" />}
      action={<span className="text-xs text-slate-500">{attachments.length} file</span>}
    >
      {KIND_ORDER.filter((k) => attachments.some((a) => (a.kind ?? 'TASK') === k)).map((k) => (
      <div key={k} className="mb-2 last:mb-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{KIND_LABEL[k]}</p>
      <ul className="-mx-2 divide-y divide-slate-100">
        {attachments.filter((a) => (a.kind ?? 'TASK') === k).map((a) => {
          const Icon = /sheet|excel/.test(a.mimeType) ? FileSpreadsheet : FileText;
          return (
            <li key={a.id} className="flex items-center gap-3 px-2 py-2">
              <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-slate-800 hover:text-cyan-700 hover:underline">{a.fileName}</a>
                <span
                  className="text-xs text-slate-500"
                  title={a.originalSize && a.originalSize > a.fileSize ? `Đã nén từ ${size(a.originalSize)}` : undefined}
                >
                  {size(a.fileSize)} · {formatDate(a.createdAt)}{a.uploadedBy && ` · ${a.uploadedBy}`}
                </span>
              </span>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700" aria-label={`Xem ${a.fileName}`}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href={`${a.url}?download=1`} className="rounded-lg p-2 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700" aria-label={`Tải về ${a.fileName}`}>
                <Download className="h-4 w-4" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
      </div>
      ))}
    </SectionCard>
  );
}
