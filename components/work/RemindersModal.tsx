'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  BellRing,
  Building2,
  Check,
  CheckSquare,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Mail,
  Search,
  Send,
  Square,
  X,
} from 'lucide-react';
import { crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { ErrorBanner } from '@/components/crm/ui';
import { formatDate } from '@/components/crm/format';
import type { ReminderDepartmentGroupDTO, ReminderItemDTO, ReminderPreviewDTO } from './types';
import { renderWorkReminderHtml } from '@/lib/email/templates/work-reminder';

function parseEmailList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )
  );
}

function normalizeFromRecipients(recipients: ReminderPreviewDTO['recipients']): ReminderDepartmentGroupDTO[] {
  const map = new Map<string, ReminderDepartmentGroupDTO>();
  for (const r of recipients) {
    const key = r.department;
    if (!map.has(key)) {
      map.set(key, {
        departmentId: null,
        department: r.department,
        defaultEmail: r.email,
        emails: r.email ? [r.email] : [],
        items: r.items.map((i) => ({
          ...i,
          departmentId: null,
          department: r.department,
          daysWithoutActivity: i.daysWithoutActivity ?? (i.health?.daysSinceActivity ?? 0),
          daysOverdue: i.daysOverdue ?? (i.health?.daysToDue && i.health.daysToDue < 0 ? -i.health.daysToDue : 0),
        })),
      });
    } else {
      const existing = map.get(key)!;
      if (r.email && !existing.emails.includes(r.email)) {
        existing.emails.push(r.email);
        existing.defaultEmail = existing.emails.join(', ');
      }
    }
  }
  return Array.from(map.values());
}

type StatusFilter = 'all' | 'stale_30' | 'stale_100' | 'overdue' | 'due_soon';
type DeptTab = 'all' | 'has_email' | 'no_email';

export function RemindersModal({ onClose, onReminded }: { onClose: () => void; onReminded?: () => void }) {
  const { data: session } = useSession();
  const [preview, setPreview] = useState<ReminderPreviewDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [departmentEmails, setDepartmentEmails] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');

  // Bộ lọc
  const [deptTab, setDeptTab] = useState<DeptTab>('all');
  const [selectedDeptKey, setSelectedDeptKey] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Preview một khoa/phòng cụ thể
  const [previewDept, setPreviewDept] = useState<ReminderDepartmentGroupDTO | null>(null);

  useEffect(() => {
    crmFetch<ReminderPreviewDTO>('/api/work/reminders')
      .then((data) => {
        setPreview(data);
        const depts = data.departments && data.departments.length > 0
          ? data.departments
          : normalizeFromRecipients(data.recipients ?? []);

        const emailsMap: Record<string, string> = {};
        const readyIds = new Set<string>();

        depts.forEach((d) => {
          const key = d.departmentId || d.department;
          const currentEmail = d.defaultEmail || d.emails.join(', ');
          emailsMap[key] = currentEmail;

          // Mặc định THÔNG MINH: Chỉ chọn các việc thuộc đơn vị ĐÃ CÓ EMAIL
          const parsed = parseEmailList(currentEmail);
          if (parsed.length > 0) {
            d.items.forEach((i) => readyIds.add(i.id));
          }
        });

        setDepartmentEmails(emailsMap);
        setSelectedIds(readyIds);
      })
      .catch((e) => setError(errorMessage(e, 'Không tải được danh sách đôn đốc công việc.')));
  }, []);

  // Danh sách các phòng ban đã chuẩn hoá
  const departments: ReminderDepartmentGroupDTO[] = useMemo(() => {
    if (!preview) return [];
    if (preview.departments && preview.departments.length > 0) {
      return preview.departments;
    }
    return normalizeFromRecipients(preview.recipients ?? []);
  }, [preview]);

  // Tất cả công việc
  const allItems: ReminderItemDTO[] = useMemo(() => {
    return departments.flatMap((d) => d.items);
  }, [departments]);

  // Thống kê tổng quan đơn vị
  const deptStats = useMemo(() => {
    let readyCount = 0;
    let missingCount = 0;

    departments.forEach((d) => {
      const key = d.departmentId || d.department;
      const raw = departmentEmails[key] ?? '';
      const parsed = parseEmailList(raw);
      if (parsed.length > 0) readyCount++;
      else missingCount++;
    });

    return {
      total: departments.length,
      readyCount,
      missingCount,
    };
  }, [departments, departmentEmails]);

  // Thống kê đếm cho các nút lọc tình trạng
  const filterCounts = useMemo(() => {
    let stale30 = 0;
    let stale100 = 0;
    let overdue = 0;
    let dueSoon = 0;

    for (const item of allItems) {
      if (item.daysWithoutActivity >= 30) stale30++;
      if (item.daysWithoutActivity >= 100) stale100++;
      if (item.reason === 'overdue' || item.daysOverdue > 0) overdue++;
      if (item.reason === 'due_soon') dueSoon++;
    }

    return {
      all: allItems.length,
      stale30,
      stale100,
      overdue,
      dueSoon,
    };
  }, [allItems]);

  // Kiểm tra item có khớp bộ lọc tình trạng & từ khoá tìm kiếm không
  const matchItemFilter = (item: ReminderItemDTO): boolean => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchStatus = item.status.toLowerCase().includes(q);
      const matchDept = item.department.toLowerCase().includes(q);
      if (!matchTitle && !matchStatus && !matchDept) return false;
    }

    switch (statusFilter) {
      case 'stale_30':
        return item.daysWithoutActivity >= 30;
      case 'stale_100':
        return item.daysWithoutActivity >= 100;
      case 'overdue':
        return item.reason === 'overdue' || item.daysOverdue > 0;
      case 'due_soon':
        return item.reason === 'due_soon';
      case 'all':
      default:
        return true;
    }
  };

  // Lọc danh sách khoa/phòng và items
  const filteredDepartments = useMemo(() => {
    return departments
      .map((dept) => {
        const key = dept.departmentId || dept.department;
        const rawEmail = departmentEmails[key] ?? '';
        const parsed = parseEmailList(rawEmail);
        const hasEmail = parsed.length > 0;

        // Lọc theo Tab đơn vị
        if (deptTab === 'has_email' && !hasEmail) return null;
        if (deptTab === 'no_email' && hasEmail) return null;

        // Lọc theo dropdown đơn vị
        if (selectedDeptKey && key !== selectedDeptKey) return null;

        // Lọc các item trong đơn vị
        const visibleItems = dept.items.filter(matchItemFilter);
        if (visibleItems.length === 0) return null;

        return {
          ...dept,
          items: visibleItems,
          totalInDept: dept.items.length,
          hasEmail,
          parsedEmails: parsed,
        };
      })
      .filter((dept): dept is NonNullable<typeof dept> => dept !== null);
  }, [departments, departmentEmails, deptTab, selectedDeptKey, statusFilter, searchQuery]);

  // Các nhiệm vụ đang hiển thị theo bộ lọc
  const visibleItems = useMemo(() => {
    return filteredDepartments.flatMap((d) => d.items);
  }, [filteredDepartments]);

  // Đối tượng đơn vị đang chọn (nếu có chọn 1 đơn vị cụ thể)
  const currentSelectedDept = useMemo(() => {
    if (!selectedDeptKey) return null;
    return departments.find((d) => (d.departmentId || d.department) === selectedDeptKey) || null;
  }, [selectedDeptKey, departments]);

  // Thay đổi đơn vị: Tự động cô lập lựa chọn cho riêng đơn vị đó
  const handleSelectDept = (deptKey: string) => {
    setSelectedDeptKey(deptKey);
    if (deptKey) {
      // Khi chọn 1 khoa/phòng cụ thể: chỉ chọn các việc của khoa/phòng đó!
      const targetDept = departments.find((d) => (d.departmentId || d.department) === deptKey);
      if (targetDept) {
        setSelectedIds(new Set(targetDept.items.map((i) => i.id)));
      }
    } else {
      // Khi chọn "Toàn bệnh viện": chọn tất cả các việc của các đơn vị đã có email
      const readyIds = new Set<string>();
      departments.forEach((d) => {
        const key = d.departmentId || d.department;
        const raw = departmentEmails[key] ?? '';
        if (parseEmailList(raw).length > 0) {
          d.items.forEach((i) => readyIds.add(i.id));
        }
      });
      setSelectedIds(readyIds);
    }
  };

  // Toggle 1 nhiệm vụ
  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Chỉ chọn các việc đang hiển thị theo bộ lọc
  const selectOnlyVisible = () => {
    setSelectedIds(new Set(visibleItems.map((i) => i.id)));
  };

  // Bỏ chọn tất cả các việc đang hiển thị theo bộ lọc
  const deselectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((i) => next.delete(i.id));
      return next;
    });
  };

  // Toggle tất cả việc của 1 phòng
  const toggleDept = (deptItems: ReminderItemDTO[], select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deptItems.forEach((i) => {
        if (select) next.add(i.id);
        else next.delete(i.id);
      });
      return next;
    });
  };

  // Chọn duy nhất các đơn vị đã có email (bỏ chọn toàn bộ việc của các đơn vị thiếu email)
  const selectOnlyReadyDepts = () => {
    const next = new Set<string>();
    departments.forEach((d) => {
      const key = d.departmentId || d.department;
      const raw = departmentEmails[key] ?? '';
      const parsed = parseEmailList(raw);
      if (parsed.length > 0) {
        d.items.forEach((i) => next.add(i.id));
      }
    });
    setSelectedIds(next);
  };

  // Bỏ chọn tất cả việc của các đơn vị đang thiếu email
  const deselectMissingEmailDepts = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      departments.forEach((d) => {
        const key = d.departmentId || d.department;
        const raw = departmentEmails[key] ?? '';
        const parsed = parseEmailList(raw);
        if (parsed.length === 0) {
          d.items.forEach((i) => next.delete(i.id));
        }
      });
      return next;
    });
  };

  // Đếm các đơn vị được chọn việc
  const activeSelectedSummary = useMemo(() => {
    const readyDepts: string[] = [];
    const missingDepts: string[] = [];

    departments.forEach((d) => {
      const selectedCount = d.items.filter((i) => selectedIds.has(i.id)).length;
      if (selectedCount === 0) return;

      const key = d.departmentId || d.department;
      const raw = departmentEmails[key] ?? '';
      const parsed = parseEmailList(raw);
      if (parsed.length > 0) {
        readyDepts.push(d.department);
      } else {
        missingDepts.push(d.department);
      }
    });

    return {
      totalSelectedTasks: selectedIds.size,
      readyDeptsCount: readyDepts.length,
      missingDepts,
    };
  }, [departments, selectedIds, departmentEmails]);

  const selectedCountInDept = currentSelectedDept
    ? currentSelectedDept.items.filter((i) => selectedIds.has(i.id)).length
    : selectedIds.size;

  const send = async () => {
    // Nếu đang chọn 1 khoa/phòng cụ thể, chỉ gửi các việc thuộc riêng khoa/phòng đó!
    const targetItemIds = currentSelectedDept
      ? currentSelectedDept.items.filter((i) => selectedIds.has(i.id)).map((i) => i.id)
      : Array.from(selectedIds);

    if (targetItemIds.length === 0) return;

    if (currentSelectedDept) {
      const key = currentSelectedDept.departmentId || currentSelectedDept.department;
      const raw = departmentEmails[key] ?? '';
      const parsed = parseEmailList(raw);
      if (parsed.length === 0) {
        setError(`Vui lòng nhập email đầu mối cho "${currentSelectedDept.department}" trước khi gửi.`);
        return;
      }
    } else if (activeSelectedSummary.missingDepts.length > 0) {
      setError(
        `Vui lòng nhập email đầu mối cho các đơn vị sau hoặc bấm "Bỏ chọn đơn vị thiếu email": ${activeSelectedSummary.missingDepts.join(
          ', '
        )}.`
      );
      return;
    }

    setSending(true);
    setError('');
    try {
      const r = await crmSend<{
        sent: number;
        failures: Array<{ department?: string; error: string }>;
        itemsReminded: number;
      }>('/api/work/reminders', 'POST', {
        selectedItemIds: targetItemIds,
        departmentEmails,
      });

      if (r.failures && r.failures.length > 0) {
        setError(`Đã gửi ${r.sent} đơn vị, nhưng có lỗi ở: ${r.failures.map((f) => `${f.department}: ${f.error}`).join('; ')}`);
      } else {
        setDone(
          `Đã gửi thành công ${r.sent} email đôn đốc theo phong cách Apple Minimalist, ghi nhận nhắc nhở cho ${r.itemsReminded} nhiệm vụ hôm nay.`
        );
      }
      onReminded?.();
    } catch (sendError) {
      setError(errorMessage(sendError, 'Không gửi được email đôn đốc.'));
    } finally {
      setSending(false);
    }
  };

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-3 sm:p-5"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-800 shrink-0">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                Đôn đốc tiến độ công việc qua Email (UMC-Office)
              </h2>
              <p className="text-xs text-slate-500">
                Gửi email phong cách Apple Minimalist đến đầu mối khoa/phòng có nhiệm vụ quá hạn hoặc lâu chưa cập nhật.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* THÂN MODAL (Scroll container duy nhất) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <ErrorBanner message={error} />

          {done && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2.5">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <span className="font-semibold">{done}</span>
            </div>
          )}

          {!preview ? (
            <div className="py-20 text-center text-sm text-slate-400 animate-pulse">
              Đang phân tích danh sách nhiệm vụ và đối chiếu đầu mối các khoa/phòng...
            </div>
          ) : allItems.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <Check className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 text-base">Tuyệt vời! Không có công việc nào cần đôn đốc.</p>
              <p className="text-xs text-slate-500 mt-1">Toàn bộ nhiệm vụ trong hệ thống đều đang được cập nhật đúng hạn.</p>
            </div>
          ) : (
            <>
              {/* TOP KPI CARDS */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Nhiệm vụ cần đôn đốc
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{allItems.length}</span>
                    <span className="text-xs text-slate-500 font-medium">({departments.length} đơn vị)</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 sm:p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Đơn vị sẵn sàng gửi
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-emerald-800">{deptStats.readyCount}</span>
                    <span className="text-xs text-emerald-600 font-medium">khoa/phòng</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3.5 sm:p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                    Chưa có email đầu mối
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-amber-900">{deptStats.missingCount}</span>
                    <span className="text-xs text-amber-700 font-medium">cần bổ sung</span>
                  </div>
                </div>
              </div>

              {/* KHUNG BỘ LỌC THÔNG MINH */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-3">
                {/* Hàng 1: Tabs phân loại đơn vị & Tìm kiếm */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Tabs đơn vị */}
                  <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDeptTab('all')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        deptTab === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả ({departments.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeptTab('has_email')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        deptTab === 'has_email' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Có email ({deptStats.readyCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeptTab('no_email')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        deptTab === 'no_email' ? 'bg-white text-amber-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Chưa có email ({deptStats.missingCount})
                    </button>
                  </div>

                  {/* Ô tìm kiếm */}
                  <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm việc, khoa phòng, trạng thái..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-9 pr-8 text-xs text-slate-800 shadow-2xs focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Hàng 2: Bộ lọc tình trạng & Dropdown phòng ban */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80 text-xs">
                  {/* Chips tình trạng */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-500 mr-1">Tình trạng:</span>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        statusFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Tất cả ({filterCounts.all})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('stale_30')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        statusFilter === 'stale_30'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      ≥ 30 ngày chưa cập nhật ({filterCounts.stale30})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('stale_100')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        statusFilter === 'stale_100'
                          ? 'bg-rose-700 text-white shadow-2xs'
                          : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      ≥ 100 ngày ({filterCounts.stale100})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('overdue')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        statusFilter === 'overdue'
                          ? 'bg-red-700 text-white shadow-2xs'
                          : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                      }`}
                    >
                      Quá hạn ({filterCounts.overdue})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('due_soon')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        statusFilter === 'due_soon'
                          ? 'bg-sky-700 text-white shadow-2xs'
                          : 'bg-white text-sky-800 border border-sky-200 hover:bg-sky-50'
                      }`}
                    >
                      Sắp đến hạn ({filterCounts.dueSoon})
                    </button>
                  </div>

                  {/* Dropdown chọn khoa/phòng */}
                  <div className="flex items-center gap-1.5 min-w-[220px]">
                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <select
                      value={selectedDeptKey}
                      onChange={(e) => handleSelectDept(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-1 px-2.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">Toàn bệnh viện ({departments.length} đơn vị · {allItems.length} việc)</option>
                      {departments.map((d) => {
                        const key = d.departmentId || d.department;
                        return (
                          <option key={key} value={key}>
                            {d.department} ({d.items.length} việc)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Hàng 3: Các nút thao tác chọn nhanh */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectOnlyVisible}
                      className="inline-flex items-center gap-1 font-semibold text-cyan-800 hover:text-cyan-950"
                      title="Chỉ chọn những việc đang hiển thị theo bộ lọc hiện tại"
                    >
                      <CheckSquare className="h-3.5 w-3.5 text-cyan-600" /> Chỉ chọn đang hiện ({visibleItems.length})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={deselectVisible}
                      className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800"
                    >
                      <Square className="h-3.5 w-3.5" /> Bỏ chọn đang hiện
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="font-medium text-slate-500 hover:text-rose-700"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentSelectedDept && (
                      <button
                        type="button"
                        onClick={() => handleSelectDept('')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1 rounded-lg border border-cyan-200 transition"
                      >
                        ← Về toàn bệnh viện
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={selectOnlyReadyDepts}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition"
                      title="Chỉ chọn những khoa/phòng đã có sẵn email để có thể bấm gửi ngay lập tức"
                    >
                      <Check className="h-3 w-3" /> Chỉ chọn đơn vị có email
                    </button>
                    {activeSelectedSummary.missingDepts.length > 0 && (
                      <button
                        type="button"
                        onClick={deselectMissingEmailDepts}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition"
                        title="Bỏ chọn các đơn vị chưa có email để không bị chặn nút gửi"
                      >
                        Bỏ chọn {activeSelectedSummary.missingDepts.length} đơn vị thiếu email
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* BANNER THÔNG BÁO KHI ĐANG LỌC RIÊNG 1 ĐƠN VỊ */}
              {currentSelectedDept && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cyan-50/90 border border-cyan-200 px-4 py-2.5 text-xs text-cyan-950 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-cyan-700 shrink-0" />
                    <span>
                      Chế độ gửi riêng cho: <strong className="font-bold text-slate-900">{currentSelectedDept.department}</strong>{' '}
                      (đang chọn <strong className="text-cyan-800 font-bold">{selectedCountInDept}</strong>/{currentSelectedDept.items.length} việc).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectDept('')}
                    className="font-semibold text-cyan-700 hover:text-cyan-900 underline"
                  >
                    ← Quay lại toàn bệnh viện
                  </button>
                </div>
              )}

              {/* DANH SÁCH CÁC KHOA / PHÒNG VÀ NHIỆM VỤ */}
              {filteredDepartments.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Filter className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 text-sm">Không tìm thấy nhiệm vụ nào khớp với bộ lọc.</p>
                  <p className="text-xs text-slate-400 mt-1">Hãy thử đổi tiêu chí hoặc bấm vào tab &ldquo;Tất cả&rdquo;.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredDepartments.map((dept) => {
                    const key = dept.departmentId || dept.department;
                    const selectedInDeptCount = dept.items.filter((i) => selectedIds.has(i.id)).length;
                    const isAnySelected = selectedInDeptCount > 0;
                    const currentRawEmail = departmentEmails[key] ?? '';
                    const parsedEmails = parseEmailList(currentRawEmail);
                    const hasEmail = parsedEmails.length > 0;

                    return (
                      <article
                        key={key}
                        className={`rounded-2xl border transition-all p-4 ${
                          isAnySelected
                            ? 'border-cyan-300 bg-white shadow-xs ring-1 ring-cyan-200/50'
                            : 'border-slate-200 bg-slate-50/40 opacity-80'
                        }`}
                      >
                        {/* Tiêu đề Khoa / Phòng & Thao tác */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="h-4 w-4 text-cyan-700 shrink-0" />
                            <h3 className="font-bold text-sm text-slate-900 truncate">
                              {dept.department}
                            </h3>
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {dept.items.length} việc
                            </span>
                            {hasEmail ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <Check className="h-3 w-3" /> Sẵn sàng
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="h-3 w-3" /> Chưa có email
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => toggleDept(dept.items, true)}
                              className="font-semibold text-cyan-700 hover:underline"
                            >
                              Chọn hết ({dept.items.length})
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => toggleDept(dept.items, false)}
                              className="font-medium text-slate-500 hover:underline"
                            >
                              Bỏ chọn
                            </button>
                            {!selectedDeptKey && (
                              <>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleSelectDept(key)}
                                  className="font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-2 py-0.5 rounded-md transition"
                                  title="Chỉ tập trung gửi đôn đốc cho riêng đơn vị này"
                                >
                                  Chỉ chọn khoa này
                                </button>
                              </>
                            )}
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setPreviewDept(dept)}
                              className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-cyan-700 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition"
                              title="Xem trước mẫu thư gửi cho khoa/phòng này"
                            >
                              <Eye className="h-3.5 w-3.5 text-cyan-600" /> Xem trước thư
                            </button>
                          </div>
                        </div>

                        {/* Ô NHẬP & CHỈNH SỬA EMAIL ĐẦU MỐI */}
                        <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 sm:p-3">
                          <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                            <label htmlFor={`email-${key}`} className="font-semibold text-slate-700 flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-cyan-600" />
                              <span>Email đầu mối nhận đôn đốc:</span>
                            </label>
                            {hasEmail ? (
                              <span className="text-[11px] text-emerald-700 font-medium">
                                ✓ {parsedEmails.length} địa chỉ hợp lệ ({parsedEmails.join(', ')})
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-700 font-semibold">
                                ⚠️ Cần nhập email để gửi được thư cho đơn vị này
                              </span>
                            )}
                          </div>
                          <input
                            id={`email-${key}`}
                            type="text"
                            value={currentRawEmail}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDepartmentEmails((prev) => ({ ...prev, [key]: val }));
                            }}
                            placeholder="Nhập email, ví dụ: thuky@umc.edu.vn, truongphong@umc.edu.vn (nhiều email cách nhau dấu phẩy)"
                            className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                              isAnySelected && !hasEmail
                                ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500'
                                : 'border-slate-300 focus:border-cyan-500 focus:ring-cyan-500'
                            }`}
                          />
                        </div>

                        {/* DANH SÁCH NHIỆM VỤ TRONG KHOA / PHÒNG */}
                        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1 space-y-1">
                          {dept.items.map((i) => {
                            const isChecked = selectedIds.has(i.id);
                            return (
                              <li
                                key={i.id}
                                onClick={() => toggleItem(i.id)}
                                className={`flex items-start gap-3 py-2 px-2.5 rounded-xl cursor-pointer transition ${
                                  isChecked ? 'bg-cyan-50/40 hover:bg-cyan-50/70' : 'hover:bg-slate-50 opacity-60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // Đã xử lý ở li onClick
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer shrink-0"
                                />

                                <div className="min-w-0 flex-1">
                                  <div
                                    className={`text-[13px] leading-snug ${
                                      isChecked ? 'font-semibold text-slate-900' : 'text-slate-500 line-through'
                                    }`}
                                  >
                                    {i.title}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-1">
                                    <span>
                                      Trạng thái: <strong>{i.status}</strong>
                                    </span>
                                    {i.dueDate && <span>&middot; Hạn: {formatDate(i.dueDate)}</span>}

                                    {/* Huy hiệu số ngày chưa cập nhật */}
                                    {i.daysWithoutActivity >= 100 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[11px] font-bold">
                                        <Clock className="h-3 w-3" /> Đã {i.daysWithoutActivity} ngày chưa cập nhật
                                      </span>
                                    ) : i.daysWithoutActivity >= 30 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-semibold">
                                        <Clock className="h-3 w-3" /> Đã {i.daysWithoutActivity} ngày chưa cập nhật
                                      </span>
                                    ) : null}

                                    {/* Huy hiệu quá hạn */}
                                    {i.daysOverdue > 0 && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[11px] font-bold">
                                        <AlertTriangle className="h-3 w-3" /> Quá hạn {i.daysOverdue} ngày
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* CHÂN MODAL (Sticky Action Bar) */}
        <div className="border-t border-slate-200 bg-white px-5 py-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {preview && (
              <div className="space-y-0.5">
                <div>
                  {currentSelectedDept ? (
                    <span>
                      Đang chọn:{' '}
                      <strong className="text-cyan-800 font-bold">
                        {currentSelectedDept.items.filter((i) => selectedIds.has(i.id)).length}
                      </strong>
                      /{currentSelectedDept.items.length} nhiệm vụ của{' '}
                      <strong className="text-slate-900 font-bold">{currentSelectedDept.department}</strong>.
                    </span>
                  ) : (
                    <span>
                      Đã chọn: <strong className="text-cyan-800 font-bold">{selectedIds.size}</strong> nhiệm vụ cho{' '}
                      <strong className="text-cyan-800 font-bold">{activeSelectedSummary.readyDeptsCount}</strong> đơn vị sẵn sàng.
                    </span>
                  )}
                </div>
                {activeSelectedSummary.missingDepts.length > 0 && (
                  <div className="text-amber-700 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>Có {activeSelectedSummary.missingDepts.length} đơn vị chưa có email đầu mối.</span>
                    <button
                      type="button"
                      onClick={deselectMissingEmailDepts}
                      className="underline hover:text-amber-900 ml-1 font-bold"
                    >
                      Bỏ chọn để gửi ngay
                    </button>
                  </div>
                )}
                {!isAdmin && (
                  <div className="text-slate-400">
                    * Tài khoản hiện tại không có quyền ADMIN (chỉ có quyền xem trước).
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentSelectedDept && (
              <button
                type="button"
                onClick={() => handleSelectDept('')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                ← Về toàn bệnh viện
              </button>
            )}

            <a
              href="/api/settings/email/preview?template=minimal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              title="Mở mẫu thư Apple Minimalist trong tab mới"
            >
              <ExternalLink className="h-3.5 w-3.5 text-cyan-600" />
              Xem mẫu thư
            </a>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={send}
              disabled={
                !preview?.canSend ||
                !isAdmin ||
                sending ||
                (currentSelectedDept ? selectedCountInDept === 0 : selectedIds.size === 0) ||
                (currentSelectedDept
                  ? parseEmailList(departmentEmails[currentSelectedDept.departmentId || currentSelectedDept.department] ?? '').length === 0
                  : activeSelectedSummary.missingDepts.length > 0)
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-800 disabled:opacity-50 transition"
            >
              <Send className="h-3.5 w-3.5" />
              {sending
                ? 'Đang gửi email...'
                : currentSelectedDept
                ? `Gửi đôn đốc (${selectedCountInDept} việc) cho ${currentSelectedDept.department}`
                : `Gửi đôn đốc (${selectedIds.size} việc cho ${activeSelectedSummary.readyDeptsCount} đơn vị)`}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL XEM TRƯỚC THƯ CỦA 1 ĐƠN VỊ CỤ THỂ */}
      {previewDept && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5"
          onMouseDown={(e) => e.target === e.currentTarget && setPreviewDept(null)}
        >
          <div className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-700" />
                <span className="font-bold text-sm text-slate-900">
                  Xem trước thư gửi: {previewDept.department}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDept(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
              <iframe
                title={`Xem trước email ${previewDept.department}`}
                srcDoc={
                  renderWorkReminderHtml({
                    recipientName: '',
                    department: previewDept.department,
                    items: previewDept.items.map((i) => ({
                      id: i.id,
                      title: i.title,
                      status: i.status,
                      dueDate: i.dueDate,
                      reasonText:
                        i.reason === 'overdue'
                          ? `Đã quá hạn ${i.daysOverdue} ngày`
                          : i.daysWithoutActivity >= 30
                          ? `Đã ${i.daysWithoutActivity} ngày chưa cập nhật`
                          : 'Sắp đến hạn',
                      isOverdue: i.daysOverdue > 0,
                      daysWithoutActivity: i.daysWithoutActivity,
                      daysOverdue: i.daysOverdue,
                    })),
                    appUrl: 'https://office.umc.edu.vn/',
                    style: 'minimal',
                  }).html
                }
                className="w-full h-[580px] bg-white rounded-2xl border border-slate-200 shadow-sm"
              />
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewDept(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Đóng xem trước
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
