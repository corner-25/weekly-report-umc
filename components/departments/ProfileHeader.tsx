'use client';

/** Đầu hồ sơ phòng ban: danh tính, tình trạng nộp báo cáo tuần mới nhất, lối tắt, mục lục. */
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_BTN, PANEL, SECONDARY_BTN } from '@/components/crm/ui';
import type { DepartmentProfile } from '@/lib/department-profile';
import { DeptIcon, FOCUS_RING, TONE_SOFT } from './bits';

export const PROFILE_SECTIONS = [
  { id: 'cong-viec', label: 'Công việc chỉ đạo' },
  { id: 'bao-cao-tuan', label: 'Nhiệm vụ báo cáo tuần' },
  { id: 'so-lieu', label: 'Số liệu theo dõi' },
  { id: 'nhan-su', label: 'Thư ký, giấy phép, MOU' },
] as const;

export function BackLink() {
  return (
    <Link href="/dashboard/departments" className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Phòng ban
    </Link>
  );
}

export function ProfileHeader({ data, onEdit }: { data: DepartmentProfile; onEdit: () => void }) {
  const latest = data.submissions[data.submissions.length - 1];
  const submittedLatest = Boolean(latest?.submitted);
  const counts: Record<(typeof PROFILE_SECTIONS)[number]['id'], number | null> = {
    'cong-viec': data.work.kpi.open,
    'bao-cao-tuan': data.threads.summary.total,
    'so-lieu': data.counts.metrics,
    'nhan-su': data.secretaries.length + data.licenses.length + data.mous.length,
  };

  return (
    <header className={cn(PANEL, 'overflow-hidden')}>
      <div className="flex flex-wrap items-start gap-4 bg-gradient-to-br from-brand-50/70 via-white to-white p-4 sm:p-5">
        <DeptIcon name={data.department.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{data.department.name}</h1>
          <p className="mt-0.5 text-sm text-slate-600">{data.department.description || 'Chưa có mô tả chức năng, nhiệm vụ.'}</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {data.latestWeek && (
              <span
                className={cn('rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset', TONE_SOFT[submittedLatest ? 'done' : 'stale'])}
                title="Phòng có trong file báo cáo tuần chung của tuần mới nhất hay chưa"
              >
                {submittedLatest ? 'Đã nộp' : 'Chưa nộp'} báo cáo tuần {data.latestWeek.week}/{data.latestWeek.year}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600" title="Tài khoản đăng nhập hệ thống gắn với phòng">
              {data.counts.accounts} tài khoản hệ thống
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600" title="Nhiệm vụ thường kỳ đang dùng trong báo cáo tuần">
              {data.counts.masterTasks} nhiệm vụ thường kỳ
            </span>
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button type="button" onClick={onEdit} className={cn(SECONDARY_BTN, 'px-3 py-2')}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Sửa thông tin
          </button>
          <Link href={`/dashboard/departments/${data.department.id}/metrics`} className={cn(SECONDARY_BTN, 'px-3 py-2')}>Định nghĩa chỉ số</Link>
        </div>
      </div>
      <nav aria-label="Mục lục hồ sơ" className="border-t border-slate-100 px-2 py-1.5">
        <ul className="flex flex-wrap gap-1">
          {PROFILE_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900', FOCUS_RING)}>
                {s.label}
                {counts[s.id] !== null && <span className="tabular-nums text-slate-400">{counts[s.id]}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
