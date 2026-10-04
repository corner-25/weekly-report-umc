'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Building2, ClipboardList, FileText, Gauge, ShieldCheck, Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crmFetch } from '@/components/crm/api';
import { formatDate } from '@/components/crm/format';
import { EmptyState, ErrorBanner, ICON_BTN, PANEL, SectionCard, Stat } from '@/components/crm/ui';
import { Sparkline } from '@/components/ui/Sparkline';
import { HealthChip, StatusChip } from '@/components/work/WorkBits';
import type { DepartmentProfile } from '@/lib/department-profile';

const fmt = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

function Delta({ latest, previous }: { latest: number; previous: number | null }) {
  if (previous === null || previous === 0) return null;
  const pct = ((latest - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-xs text-slate-400">không đổi</span>;
  return <span className={cn('text-xs font-semibold', pct > 0 ? 'text-emerald-600' : 'text-rose-600')}>{pct > 0 ? '+' : ''}{pct.toFixed(0)}%</span>;
}

/** Hồ sơ 360 của phòng ban: báo cáo, nhiệm vụ, chỉ số, công việc chỉ đạo, thư ký, giấy phép, MOU. */
export default function DepartmentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading } = useSWR<DepartmentProfile>(`/api/departments/${id}/profile`, (url: string) => crmFetch<DepartmentProfile>(url), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const back = (
    <Link href="/dashboard/departments" className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Phòng ban
    </Link>
  );
  if (error) {
    return <div className="space-y-4">{back}{(error as { status?: number }).status === 404 ? <EmptyState title="Không tìm thấy phòng ban" /> : <ErrorBanner message={error.message} />}</div>;
  }
  if (isLoading || !data) return <ProfileSkeleton back={back} />;

  const c = data.counts;
  return (
    <div className="space-y-5">
      {back}

      <header className={cn(PANEL, 'flex flex-wrap items-center gap-4 p-4 sm:p-5')}>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Building2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{data.department.name}</h1>
          <p className="text-sm text-slate-500">
            {data.department.description || 'Hồ sơ tổng hợp từ báo cáo tuần, chỉ số, công việc chỉ đạo và nhân sự.'}
            {data.latestWeek && ` · Tuần gần nhất: ${data.latestWeek.week}/${data.latestWeek.year}`}
          </p>
        </div>
        <Link href={`/dashboard/departments/${id}/metrics`} className="text-sm font-medium text-brand-700 hover:underline">Định nghĩa chỉ số →</Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Nộp báo cáo" value={`${c.weeksSubmitted}/${c.weeksShown}`} hint="12 tuần gần nhất" />
        <Stat label="Nhiệm vụ thường kỳ" value={c.masterTasks} />
        <Stat label="Chỉ số theo dõi" value={c.metrics} hint={c.flaggedMetrics ? `${c.flaggedMetrics} số liệu cần rà soát` : undefined} />
        <Stat label="Công việc đang mở" value={c.openWork} hint={c.overdueWork ? `${c.overdueWork} quá hạn` : undefined} tone={c.overdueWork ? 'accent' : 'default'} />
        <Stat label="Thư ký" value={c.secretaries} />
        <Stat label="Tài khoản hệ thống" value={c.accounts} />
      </div>

      <SectionCard title="Nộp báo cáo tuần" icon={<FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />}>
        <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label="12 tuần gần nhất">
          {data.submissions.map((s) => (
            <li
              key={`${s.year}-${s.week}`}
              title={s.submitted ? `Tuần ${s.week}: ${s.taskCount ?? '?'} nhiệm vụ` : `Tuần ${s.week}: chưa có trong báo cáo chung`}
              className={cn(
                'rounded-lg py-1.5 text-center text-[11px] font-semibold tabular-nums',
                s.submitted ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-1 ring-inset ring-dashed ring-slate-300',
              )}
            >
              T{s.week}
              <span className="block text-[10px] font-medium">{s.submitted ? `${s.taskCount ?? ''} NV` : 'chưa'}</span>
            </li>
          ))}
        </ol>
      </SectionCard>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Chỉ số theo tuần" icon={<Gauge className="h-4 w-4 text-brand-600" aria-hidden="true" />} action={<Link href="/dashboard/reports/metrics-data" className="text-xs font-semibold text-brand-700 hover:underline">Bảng số liệu →</Link>}>
            {data.metricGroups.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có chỉ số chuẩn cho phòng này trong 12 tuần qua.</p>
            ) : (
              <div className="space-y-5">
                {data.metricGroups.map((g) => (
                  <div key={g.group}>
                    <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{g.group}{g.total > g.metrics.length && <span className="font-medium normal-case tracking-normal text-slate-400"> · {g.metrics.length}/{g.total} chỉ số</span>}</h3>
                    <ul className="divide-y divide-slate-100">
                      {g.metrics.map((m) => (
                        <li key={m.path} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-slate-800" title={m.name}>{m.name}</span>
                            <span className="text-[11px] text-slate-400">tuần {m.latest.week} · {m.series.length} tuần dữ liệu</span>
                          </span>
                          <Sparkline values={m.series.map((p) => p.value)} />
                          <span className="w-28 text-right">
                            <span className="block text-sm font-bold tabular-nums text-slate-900">{fmt(m.latest.value)}{m.unit && <span className="ml-1 text-xs font-normal text-slate-400">{m.unit}</span>}</span>
                            <Delta latest={m.latest.value} previous={m.previous?.value ?? null} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={data.latestWeek ? `Nhiệm vụ tuần ${data.latestWeek.week}` : 'Nhiệm vụ tuần gần nhất'} action={<span className="text-xs text-slate-500">{data.latestTasks.length} nhiệm vụ</span>}>
            {data.latestTasks.length === 0 ? (
              <p className="text-sm text-slate-500">Phòng chưa có nhiệm vụ trong tuần gần nhất.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.latestTasks.map((t) => (
                  <li key={t.id} className="py-2.5 text-sm">
                    <p className="flex items-start gap-1.5 font-semibold text-slate-900">
                      {t.isImportant && <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Quan trọng" />}
                      {t.name}
                      {t.progress != null && <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-brand-700">{t.progress}%</span>}
                    </p>
                    {t.result && <p className="mt-0.5 whitespace-pre-line text-slate-600 line-clamp-3">{t.result}</p>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Công việc chỉ đạo đang mở" icon={<ClipboardList className="h-4 w-4 text-brand-600" aria-hidden="true" />} action={<Link href={`/dashboard/work/items?departmentId=${id}`} className="text-xs font-semibold text-brand-700 hover:underline">Xem tất cả →</Link>}>
            {data.work.length === 0 ? (
              <p className="text-sm text-slate-500">Không có công việc chỉ đạo nào đang mở.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.work.map((w) => (
                  <li key={w.id} className="py-2">
                    <Link href={`/dashboard/work/items/${w.id}`} className="block text-sm font-semibold text-slate-900 hover:text-brand-700 line-clamp-2">{w.title}</Link>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusChip status={w.status} />
                      <HealthChip health={w.health} />
                      {w.dueDate && <span className="text-xs text-slate-500">hạn {formatDate(w.dueDate)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={`Thư ký (${data.secretaries.length})`} icon={<Users className="h-4 w-4 text-brand-600" aria-hidden="true" />} action={<Link href="/dashboard/secretaries" className="text-xs font-semibold text-brand-700 hover:underline">Danh sách →</Link>}>
            {data.secretaries.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có thư ký nào thuộc phòng này.</p>
            ) : (
              <ul className="space-y-2">
                {data.secretaries.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? '#94a3b8' }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{s.fullName}</span>
                      <span className="block truncate text-xs text-slate-500">{[s.type, s.email ?? 'chưa có email', s.birthday && `SN ${s.birthday}`].filter(Boolean).join(' · ')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {(data.licenses.length > 0 || data.mous.length > 0) && (
            <SectionCard title="Giấy phép & MOU" icon={<ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />}>
              <ul className="divide-y divide-slate-100 text-sm">
                {data.licenses.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-slate-800">{l.name}</span>
                    <span className={cn('shrink-0 text-xs font-semibold', l.daysLeft !== null && l.daysLeft < 0 ? 'text-rose-600' : l.daysLeft !== null && l.daysLeft < 60 ? 'text-amber-700' : 'text-slate-500')}>
                      {l.expiryDate ? `hết hạn ${formatDate(l.expiryDate)}` : 'không thời hạn'}
                    </span>
                  </li>
                ))}
                {data.mous.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-slate-800">MOU · {m.partnerName}</span>
                    <span className="shrink-0 text-xs text-slate-500">{m.expiryDate ? formatDate(m.expiryDate) : m.status}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

/** Khung chờ đúng bố cục thật — trang không nhảy khi dữ liệu về. */
function ProfileSkeleton({ back }: { back: React.ReactNode }) {
  const block = 'animate-pulse rounded-2xl bg-slate-200/70';
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Đang tải hồ sơ phòng ban">
      {back}
      <div className={cn(block, 'h-24')} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className={cn(block, 'h-20')} />)}</div>
      <div className={cn(block, 'h-24')} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"><div className={cn(block, 'h-96')} /><div className={cn(block, 'h-96')} /></div>
    </div>
  );
}
