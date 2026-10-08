'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { AlertTriangle, ArrowRight, CalendarClock, Gift, HeartHandshake } from 'lucide-react';
import { DATE_KIND_LABELS, INTERACTION_TYPE_LABELS } from '@/lib/crm/constants';
import { crmFetch } from './api';
import { daysUntilLabel, displayName, formatDate } from './format';
import type { OverviewDTO } from './types';

/** Cửa sổ ngắn cho trang tổng quan chung — chi tiết 30/90 ngày ở trang CRM. */
const WINDOW_DAYS = 14;
const PREVIEW = 4;

/**
 * Khối CRM trên Dashboard chính: lịch dẫn khách sắp tới, dịp đối tác sắp tới,
 * số lượt trong tháng. Tải riêng — CRM lỗi không làm hỏng cả Dashboard.
 */
export function DashboardCrmWidget() {
  const { data, error } = useSWR<OverviewDTO>(`/api/crm/overview?window=${WINDOW_DAYS}`, (url: string) => crmFetch<OverviewDTO>(url), {
    revalidateOnFocus: false,
  });
  // Dịp đã tới hạn nhắc mà chưa ai lên kế hoạch quà/hoa.
  const unplannedCare = data?.careDue.filter((d) => !d.task).length ?? 0;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm" aria-labelledby="crm-widget-heading">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
            <HeartHandshake className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="crm-widget-heading" className="font-semibold text-slate-900">CRM đối tác</h2>
            <p className="text-sm text-slate-500">
              {data
                ? `Tháng này: ${data.counts.vipEscortsThisMonth} lượt dẫn khám VIP · ${data.counts.delegationsThisMonth} đoàn`
                : error ? 'Không tải được dữ liệu CRM' : 'Đang tải…'}
            </p>
          </div>
        </div>
        <Link href="/dashboard/crm" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          Mở <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {data && (
        <div className="space-y-4 px-5 py-4">
          {(data.overduePlanned.length > 0 || unplannedCare > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {data.overduePlanned.length > 0 && (
                <Link
                  href="/dashboard/crm"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <span>{data.overduePlanned.length} lịch hẹn đã qua chưa cập nhật kết quả</span>
                </Link>
              )}
              {unplannedCare > 0 && (
                <Link
                  href="/dashboard/crm"
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/80 bg-rose-50 px-3.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs"
                >
                  <Gift className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden="true" />
                  <span>{unplannedCare} dịp cần chuẩn bị quà/hoa</span>
                </Link>
              )}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Lịch dẫn khách & đoàn
              </h3>
              {data.planned.length === 0 ? (
                <p className="text-sm text-slate-500">Không có lịch hẹn trong {WINDOW_DAYS} ngày tới.</p>
              ) : (
                <ul className="space-y-2">
                  {data.planned.slice(0, PREVIEW).map((p) => (
                    <li key={p.id} className="flex items-start gap-3">
                      <div className="w-12 shrink-0 text-center">
                        <div className="text-sm font-semibold tabular-nums text-slate-900">{formatDate(p.occurredAt, 'dd/MM')}</div>
                        <div className="text-[11px] tabular-nums text-slate-400">{formatDate(p.occurredAt, 'HH:mm')}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {p.contact ? displayName(p.contact) : p.organization?.name ?? INTERACTION_TYPE_LABELS[p.type]}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {INTERACTION_TYPE_LABELS[p.type]}{p.destination ? ` · ${p.destination}` : ''} · {p.staffName}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Dịp đối tác {WINDOW_DAYS} ngày tới</h3>
              {data.upcoming.length === 0 ? (
                <p className="text-sm text-slate-500">Không có sinh nhật hay ngày kỷ niệm nào.</p>
              ) : (
                <ul className="space-y-2">
                  {data.upcoming.slice(0, PREVIEW).map((u) => (
                    <li key={u.key}>
                      <Link
                        href={`/dashboard/crm/${u.target.type === 'contact' ? 'contacts' : 'organizations'}/${u.target.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg px-1 py-0.5 hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{u.target.name}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {u.label || DATE_KIND_LABELS[u.kind]} · {formatDate(u.date, 'dd/MM')}{u.isLunar ? ' (âm lịch)' : ''}
                          </span>
                        </span>
                        <span className={`shrink-0 text-xs font-semibold ${u.daysUntil === 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                          {daysUntilLabel(u.daysUntil)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
