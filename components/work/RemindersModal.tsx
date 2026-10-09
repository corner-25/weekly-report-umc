'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  Building2,
  CheckSquare,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Info,
  Mail,
  Search,
  Send,
  Square,
  X,
} from 'lucide-react';
import { crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { ErrorBanner, ModalShell, PRIMARY_BTN } from '@/components/crm/ui';
import { formatDate } from '@/components/crm/format';
import type { ReminderDepartmentGroupDTO, ReminderItemDTO, ReminderPreviewDTO } from './types';

const REASON: Record<string, string> = {
  overdue: 'Quá hạn',
  due_soon: 'Sắp đến hạn',
  stale: 'Lâu chưa cập nhật',
};

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

type QuickFilter =
  | 'all'
  | 'stale_100'
  | 'stale_60'
  | 'stale_30'
  | 'overdue_100'
  | 'overdue_30'
  | 'all_overdue'
  | 'due_soon'
  | 'custom_stale';

export function RemindersModal({ onClose, onReminded }: { onClose: () => void; onReminded?: () => void }) {
  const { data: session } = useSession();
  const [preview, setPreview] = useState<ReminderPreviewDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [departmentEmails, setDepartmentEmails] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');

  // Bộ lọc
  const [selectedDeptKey, setSelectedDeptKey] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [customDays, setCustomDays] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    crmFetch<ReminderPreviewDTO>('/api/work/reminders')
      .then((data) => {
        setPreview(data);
        const depts = data.departments && data.departments.length > 0
          ? data.departments
          : normalizeFromRecipients(data.recipients ?? []);

        const emailsMap: Record<string, string> = {};
        const allIds = new Set<string>();

        depts.forEach((d) => {
          const key = d.departmentId || d.department;
          emailsMap[key] = d.defaultEmail || d.emails.join(', ');
          d.items.forEach((i) => allIds.add(i.id));
        });

        setDepartmentEmails(emailsMap);
        setSelectedIds(allIds);
      })
      .catch((e) => setError(errorMessage(e, 'Không tải được danh sách nhắc.')));
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

  // Thống kê nhanh cho các nút lọc
  const filterCounts = useMemo(() => {
    let stale100 = 0;
    let stale60 = 0;
    let stale30 = 0;
    let overdue100 = 0;
    let overdue30 = 0;
    let allOverdue = 0;
    let dueSoon = 0;

    for (const item of allItems) {
      if (item.daysWithoutActivity >= 100) stale100++;
      if (item.daysWithoutActivity >= 60) stale60++;
      if (item.daysWithoutActivity >= 30) stale30++;
      if (item.daysOverdue >= 100) overdue100++;
      if (item.daysOverdue >= 30) overdue30++;
      if (item.reason === 'overdue' || item.daysOverdue > 0) allOverdue++;
      if (item.reason === 'due_soon') dueSoon++;
    }

    return {
      all: allItems.length,
      stale100,
      stale60,
      stale30,
      overdue100,
      overdue30,
      allOverdue,
      dueSoon,
    };
  }, [allItems]);

  // Kiểm tra một item có khớp bộ lọc hiện tại hay không
  const matchFilter = (item: ReminderItemDTO): boolean => {
    // 1. Lọc theo từ khoá tìm kiếm
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchStatus = item.status.toLowerCase().includes(q);
      const matchDept = item.department.toLowerCase().includes(q);
      if (!matchTitle && !matchStatus && !matchDept) return false;
    }

    // 2. Lọc theo thời gian / tình trạng
    switch (quickFilter) {
      case 'stale_100':
        return item.daysWithoutActivity >= 100;
      case 'stale_60':
        return item.daysWithoutActivity >= 60;
      case 'stale_30':
        return item.daysWithoutActivity >= 30;
      case 'overdue_100':
        return item.daysOverdue >= 100;
      case 'overdue_30':
        return item.daysOverdue >= 30;
      case 'all_overdue':
        return item.reason === 'overdue' || item.daysOverdue > 0;
      case 'due_soon':
        return item.reason === 'due_soon';
      case 'custom_stale':
        return item.daysWithoutActivity >= (customDays || 0);
      case 'all':
      default:
        return true;
    }
  };

  // Lọc các phòng ban và items hiển thị
  const filteredDepartments = useMemo(() => {
    return departments
      .map((dept) => {
        const key = dept.departmentId || dept.department;
        // Nếu chọn 1 phòng ban cụ thể
        if (selectedDeptKey && key !== selectedDeptKey) {
          return null;
        }

        const visibleItems = dept.items.filter(matchFilter);
        return {
          ...dept,
          items: visibleItems,
          totalInDept: dept.items.length,
        };
      })
      .filter((dept): dept is NonNullable<typeof dept> => dept !== null && dept.items.length > 0);
  }, [departments, selectedDeptKey, quickFilter, customDays, searchQuery]);

  // Tổng số nhiệm vụ đang hiển thị theo bộ lọc
  const visibleItems = useMemo(() => {
    return filteredDepartments.flatMap((d) => d.items);
  }, [filteredDepartments]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Chọn hoặc bỏ chọn tất cả các việc đang hiển thị
  const toggleAllVisible = (select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((item) => {
        if (select) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
  };

  // Chọn hoặc bỏ chọn tất cả việc của 1 phòng
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

  // Các đơn vị có việc được tick chọn
  const activeDepartmentsWithSelected = useMemo(() => {
    return departments
      .map((d) => {
        const selectedInDept = d.items.filter((i) => selectedIds.has(i.id));
        const key = d.departmentId || d.department;
        const rawEmail = departmentEmails[key] ?? '';
        const parsedEmails = parseEmailList(rawEmail);
        return {
          dept: d,
          key,
          selectedCount: selectedInDept.length,
          parsedEmails,
        };
      })
      .filter((d) => d.selectedCount > 0);
  }, [departments, selectedIds, departmentEmails]);

  // Kiểm tra xem có đơn vị nào được chọn việc mà chưa nhập email đầu mối hay không
  const missingEmailDepts = useMemo(() => {
    return activeDepartmentsWithSelected.filter((d) => d.parsedEmails.length === 0);
  }, [activeDepartmentsWithSelected]);

  const send = async () => {
    if (selectedIds.size === 0) return;
    if (missingEmailDepts.length > 0) {
      setError(
        `Vui lòng nhập email đầu mối cho các đơn vị sau trước khi gửi: ${missingEmailDepts
          .map((d) => d.dept.department)
          .join(', ')}.`
      );
      return;
    }

    setSending(true);
    setError('');
    try {
      const r = await crmSend<{ sent: number; failures: Array<{ department?: string; error: string }>; itemsReminded: number }>(
        '/api/work/reminders',
        'POST',
        {
          selectedItemIds: Array.from(selectedIds),
          departmentEmails,
        }
      );

      if (r.failures && r.failures.length > 0) {
        setError(`Đã gửi ${r.sent} đơn vị, nhưng có lỗi ở: ${r.failures.map((f) => `${f.department}: ${f.error}`).join('; ')}`);
      } else {
        setDone(`Đã gửi thành công ${r.sent} email đôn đốc cho các đơn vị, ghi nhận nhắc việc cho ${r.itemsReminded} công việc hôm nay.`);
      }
      onReminded?.();
    } catch (sendError) {
      setError(errorMessage(sendError, 'Không gửi được email.'));
    } finally {
      setSending(false);
    }
  };

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <ModalShell
      title="Đôn đốc tiến độ công việc qua Email (UMC-Office)"
      subtitle="Lọc nhanh nhiệm vụ quá hạn/lâu chưa cập nhật, chỉnh sửa email đầu mối đơn vị và gửi email thông báo đôn đốc."
      onClose={onClose}
    >
      <div className="space-y-4 p-5 sm:p-6 max-h-[82vh] overflow-y-auto">
        <ErrorBanner message={error} />
        {done && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-center gap-2">
            <span className="font-semibold">✓ {done}</span>
          </div>
        )}

        {/* Khung hướng dẫn hành chính */}
        <div className="rounded-xl bg-cyan-50/70 border border-cyan-200/80 p-3.5 text-xs text-cyan-900 flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 text-cyan-700 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Mẫu email đôn đốc được gửi từ Phòng Hành chính (hanhchinh@umc.edu.vn):</p>
            <p className="text-cyan-800">
              Email gửi đến <strong>đầu mối đơn vị</strong> phụ trách nhiệm vụ. Thư có kèm quy định bắt buộc về nội dung báo cáo kết quả trên UMC-Office (phải nêu rõ sản phẩm đầu ra, số liệu nghiệm thu, văn bản đính kèm).
            </p>
          </div>
        </div>

        {!preview ? (
          <div className="py-12 text-center text-sm text-slate-500 animate-pulse">Đang nạp danh sách công việc cần đôn đốc...</div>
        ) : allItems.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">Hiện không có công việc nào quá hạn hoặc cần đôn đốc.</p>
        ) : (
          <>
            {/* THANH BỘ LỌC TỐC ĐỘ CAO */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Filter className="h-3.5 w-3.5 text-cyan-700" />
                <span>Bộ lọc nhanh</span>
              </div>

              {/* Hàng 1: Lọc theo Phòng ban & Tìm kiếm */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="dept-select" className="block text-xs font-semibold text-slate-700 mb-1">
                    Chọn phòng ban / Đơn vị phụ trách:
                  </label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <select
                      id="dept-select"
                      value={selectedDeptKey}
                      onChange={(e) => setSelectedDeptKey(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-800 shadow-2xs focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">Tất cả phòng ban ({departments.length} đơn vị · {allItems.length} việc)</option>
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

                <div>
                  <label htmlFor="search-task" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tìm kiếm nhiệm vụ:
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="search-task"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm nội dung, trạng thái, phòng ban..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-800 shadow-2xs focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
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
              </div>

              {/* Hàng 2: Nút lọc nhanh theo thời gian & tình trạng */}
              <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500">Tiêu chí lọc thời gian:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickFilter('all')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      quickFilter === 'all'
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả ({filterCounts.all})
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter('stale_100')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                      quickFilter === 'stale_100'
                        ? 'bg-rose-700 text-white shadow-2xs'
                        : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    ≥ 100 ngày chưa phản hồi ({filterCounts.stale100})
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter('stale_60')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      quickFilter === 'stale_60'
                        ? 'bg-amber-700 text-white shadow-2xs'
                        : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    ≥ 60 ngày ({filterCounts.stale60})
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter('stale_30')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      quickFilter === 'stale_30'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    ≥ 30 ngày ({filterCounts.stale30})
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter('overdue_100')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      quickFilter === 'overdue_100'
                        ? 'bg-red-700 text-white shadow-2xs'
                        : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                    }`}
                  >
                    Quá hạn &gt; 100 ngày ({filterCounts.overdue100})
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter('all_overdue')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      quickFilter === 'all_overdue'
                        ? 'bg-red-600 text-white shadow-2xs'
                        : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                    }`}
                  >
                    Tất cả quá hạn ({filterCounts.allOverdue})
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter('due_soon')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      quickFilter === 'due_soon'
                        ? 'bg-sky-700 text-white shadow-2xs'
                        : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
                    }`}
                  >
                    Sắp đến hạn ({filterCounts.dueSoon})
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter('custom_stale')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      quickFilter === 'custom_stale'
                        ? 'bg-purple-700 text-white shadow-2xs'
                        : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    Tuỳ chỉnh ngày
                  </button>
                </div>

                {quickFilter === 'custom_stale' && (
                  <div className="mt-2 flex items-center gap-2 text-xs bg-purple-50/70 p-2 rounded-lg border border-purple-200 text-purple-900">
                    <span>Lọc nhiệm vụ có số ngày chưa phản hồi ≥</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={customDays}
                      onChange={(e) => setCustomDays(Number(e.target.value) || 0)}
                      className="w-16 rounded border border-purple-300 bg-white px-2 py-0.5 text-center text-xs font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <span>ngày</span>
                  </div>
                )}
              </div>
            </div>

            {/* THANH CHỌN/BỎ CHỌN & THỐNG KÊ KẾT QUẢ LỌC */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleAllVisible(true)}
                  className="inline-flex items-center gap-1 font-semibold text-cyan-700 hover:text-cyan-900"
                >
                  <CheckSquare className="h-3.5 w-3.5" /> Chọn tất cả đang lọc ({visibleItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllVisible(false)}
                  className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800"
                >
                  <Square className="h-3.5 w-3.5" /> Bỏ chọn đang lọc
                </button>
              </div>

              <div className="text-slate-600">
                Đang hiển thị: <strong className="text-slate-900">{visibleItems.length}</strong>/{allItems.length} việc
                ({filteredDepartments.length} đơn vị) &middot; Đã chọn:{' '}
                <strong className="text-cyan-800">{selectedIds.size}</strong> việc cho{' '}
                <strong className="text-cyan-800">{activeDepartmentsWithSelected.length}</strong> đơn vị
              </div>
            </div>

            {/* DANH SÁCH CÁC ĐƠN VỊ VÀ NHIỆM VỤ */}
            {filteredDepartments.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <p className="font-semibold text-slate-700">Không tìm thấy nhiệm vụ nào khớp với bộ lọc.</p>
                <p className="text-xs mt-1">Hãy thử bấm &ldquo;Tất cả&rdquo; hoặc bỏ bớt điều kiện tìm kiếm.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDepartments.map((dept) => {
                  const key = dept.departmentId || dept.department;
                  const selectedInDeptCount = dept.items.filter((i) => selectedIds.has(i.id)).length;
                  const currentRawEmail = departmentEmails[key] ?? '';
                  const parsedEmails = parseEmailList(currentRawEmail);
                  const isAnySelected = selectedInDeptCount > 0;
                  const hasEmail = parsedEmails.length > 0;

                  return (
                    <article
                      key={key}
                      className={`rounded-2xl border transition-all p-4 ${
                        isAnySelected
                          ? 'border-cyan-300/80 bg-white shadow-xs'
                          : 'border-slate-200 bg-slate-50/50 opacity-75'
                      }`}
                    >
                      {/* Tiêu đề đơn vị & Thao tác chọn */}
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-cyan-700 shrink-0" />
                            <span className="truncate">{dept.department}</span>
                          </h3>
                        </div>

                        <div className="flex items-center gap-2.5 text-xs">
                          <button
                            type="button"
                            onClick={() => toggleDept(dept.items, true)}
                            className="font-medium text-cyan-700 hover:underline"
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
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              selectedInDeptCount > 0
                                ? 'bg-cyan-100 text-cyan-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            Đã chọn {selectedInDeptCount}/{dept.items.length} việc
                          </span>
                        </div>
                      </div>

                      {/* KHUNG NHẬP EMAIL ĐẦU MỐI ĐƠN VỊ */}
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-semibold text-slate-700">
                          <label htmlFor={`email-${key}`} className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                            <span>Email đầu mối đơn vị nhận đôn đốc:</span>
                          </label>

                          {hasEmail ? (
                            <span className="text-[11px] font-medium text-cyan-800 bg-cyan-100/90 px-2 py-0.5 rounded-full">
                              {parsedEmails.length} email sẽ nhận
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Chưa có email
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
                          placeholder="Nhập email đầu mối, ví dụ: thuky@umc.edu.vn, truongphong@umc.edu.vn (nhiều email cách nhau bằng dấu phẩy)"
                          className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                            isAnySelected && !hasEmail
                              ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500'
                              : 'border-slate-300 focus:border-cyan-500 focus:ring-cyan-500'
                          }`}
                        />

                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>
                            Tên gọi trong thư: <strong>Đầu mối phụ trách công việc &middot; {dept.department}</strong>
                          </span>
                          {parsedEmails.length > 0 && (
                            <span className="text-slate-400">
                              (Hợp lệ: {parsedEmails.join(', ')})
                            </span>
                          )}
                        </div>

                        {isAnySelected && !hasEmail && (
                          <p className="mt-1.5 text-[11px] font-medium text-amber-800 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            Đã chọn {selectedInDeptCount} việc của phòng này nhưng chưa có email đầu mối. Vui lòng nhập ít nhất 1 email để gửi.
                          </p>
                        )}
                      </div>

                      {/* DANH SÁCH CÔNG VIỆC CỦA ĐƠN VỊ */}
                      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1 text-sm space-y-1">
                        {dept.items.map((i) => {
                          const isChecked = selectedIds.has(i.id);
                          return (
                            <li
                              key={i.id}
                              onClick={() => toggleItem(i.id)}
                              className="flex items-start gap-2.5 py-2 cursor-pointer hover:bg-slate-50/80 rounded-lg px-2 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // Đã xử lý ở li onClick
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer shrink-0"
                              />

                              <div className="min-w-0 flex-1">
                                <span
                                  className={`text-[13.5px] leading-snug block ${
                                    isChecked ? 'font-medium text-slate-900' : 'text-slate-500 line-through'
                                  }`}
                                >
                                  {i.title}
                                </span>

                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-1">
                                  <span>Trạng thái: <strong>{i.status}</strong></span>
                                  {i.dueDate && <span>&middot; Hạn: {formatDate(i.dueDate)}</span>}

                                  {/* Hiển thị số ngày chưa phản hồi nổi bật */}
                                  {i.daysWithoutActivity >= 100 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                                      <AlertTriangle className="h-3 w-3 shrink-0" />
                                      {i.daysWithoutActivity} ngày chưa phản hồi
                                    </span>
                                  ) : i.daysWithoutActivity >= 30 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                      <Clock className="h-3 w-3 shrink-0" />
                                      {i.daysWithoutActivity} ngày chưa cập nhật
                                    </span>
                                  ) : null}

                                  {/* Hiển thị số ngày quá hạn */}
                                  {i.daysOverdue > 0 && (
                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                      Quá hạn {i.daysOverdue} ngày
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  i.reason === 'overdue' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {REASON[i.reason] || i.reason}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Chân Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="text-xs text-slate-500">
                {!preview.canSend && (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Chưa cấu hình SMTP trên máy chủ (chỉ xem trước).
                  </span>
                )}
                {preview.canSend && !isAdmin && <span>Chỉ tài khoản quản trị viên (ADMIN) mới có quyền gửi thật.</span>}
                {missingEmailDepts.length > 0 && selectedIds.size > 0 && (
                  <span className="text-amber-700 font-medium ml-2">
                    (Có {missingEmailDepts.length} đơn vị đã chọn việc nhưng chưa có email đầu mối)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <a
                  href="/api/settings/email/preview?template=modern"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition shadow-2xs"
                  title="Mở xem trước mẫu thư HTML trong tab mới"
                >
                  <Eye className="h-4 w-4 text-cyan-700" />
                  Xem trước mẫu thư
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={
                    !preview.canSend ||
                    !isAdmin ||
                    sending ||
                    selectedIds.size === 0 ||
                    missingEmailDepts.length > 0
                  }
                  className={PRIMARY_BTN}
                  title={
                    missingEmailDepts.length > 0
                      ? `Cần nhập email cho: ${missingEmailDepts.map((d) => d.dept.department).join(', ')}`
                      : undefined
                  }
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {sending
                    ? 'Đang gửi email...'
                    : `Gửi đôn đốc (${selectedIds.size} việc cho ${activeDepartmentsWithSelected.length} đơn vị)`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
