'use client';

/**
 * Quản lý danh mục phòng ban: thêm, sửa, xoá — tách khỏi bảng tổng quan để trang
 * chính chỉ còn số liệu. Xoá bị API chặn nếu phòng còn nhiệm vụ.
 */
import { useMemo, useState } from 'react';
import { ClipboardList, Handshake, Pencil, Plus, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toSearchKey } from '@/lib/crm/constants';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { ErrorBanner, ICON_BTN, ModalShell, PRIMARY_BTN, inputClass } from '@/components/crm/ui';
import type { DepartmentOverviewRow } from '@/lib/department-overview';
import { DeptIcon } from './bits';
import { DepartmentForm, type EditableDepartment } from './DepartmentForm';

type Mode = { kind: 'list' } | { kind: 'form'; department: EditableDepartment | null };

interface DepartmentAdminModalProps {
  departments: DepartmentOverviewRow[];
  /** Mở thẳng form thêm mới. */
  startWithCreate?: boolean;
  onClose: () => void;
  /** Gọi sau mỗi lần thêm/sửa/xoá thành công để tải lại tổng quan. */
  onChanged: () => void;
}

export function DepartmentAdminModal({ departments, startWithCreate = false, onClose, onChanged }: DepartmentAdminModalProps) {
  const [mode, setMode] = useState<Mode>(startWithCreate ? { kind: 'form', department: null } : { kind: 'list' });
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DepartmentOverviewRow | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const shown = useMemo(() => {
    const q = toSearchKey(query.trim());
    return q ? departments.filter((d) => toSearchKey(d.name, d.description).includes(q)) : departments;
  }, [departments, query]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setError('');
    try {
      await crmFetch(`/api/departments/${target.id}`, { method: 'DELETE' });
      setNotice(`Đã xoá "${target.name}".`);
      onChanged();
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Không xoá được phòng ban.'));
    }
  };

  const handleSaved = (saved: EditableDepartment, isNew: boolean) => {
    setNotice(isNew ? `Đã thêm "${saved.name}".` : `Đã lưu "${saved.name}".`);
    setError('');
    setMode({ kind: 'list' });
    onChanged();
  };

  // Esc khi đang hỏi xác nhận xoá thì chỉ đóng hộp xác nhận.
  const close = () => (deleteTarget ? setDeleteTarget(null) : mode.kind === 'form' && !startWithCreate ? setMode({ kind: 'list' }) : onClose());

  if (mode.kind === 'form') {
    const editing = mode.department;
    return (
      <ModalShell key="form" title={editing ? 'Sửa phòng ban' : 'Thêm phòng ban'} subtitle={editing?.name} onClose={close} size="md">
        <DepartmentForm
          department={editing}
          onCancel={() => (startWithCreate ? onClose() : setMode({ kind: 'list' }))}
          onSaved={(saved) => {
            if (!startWithCreate) return handleSaved(saved, !editing);
            onChanged();
            onClose();
          }}
        />
      </ModalShell>
    );
  }

  return (
    <>
      <ModalShell key="list" title="Quản lý danh mục phòng ban" subtitle={`${departments.length} phòng ban đang hoạt động`} onClose={close}>
        <div className="space-y-3 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Tìm phòng ban</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm phòng ban…" className={inputClass(undefined, 'pl-9')} />
            </label>
            <button type="button" onClick={() => setMode({ kind: 'form', department: null })} className={PRIMARY_BTN}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Thêm phòng
            </button>
          </div>
          <ErrorBanner message={error} />
          {notice && !error && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</p>}
          <p className="text-xs text-slate-500">
            Số ở mỗi dòng: <ClipboardList className="inline h-3 w-3" aria-hidden="true" /> nhiệm vụ thường kỳ · <Users className="inline h-3 w-3" aria-hidden="true" /> thư ký ·{' '}
            <Handshake className="inline h-3 w-3" aria-hidden="true" /> MOU · <ShieldCheck className="inline h-3 w-3" aria-hidden="true" /> giấy phép. Không xoá được phòng còn nhiệm vụ.
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Không có phòng nào khớp “{query}”.</li>}
            {shown.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <DeptIcon name={d.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{d.name}</span>
                  <span className="block truncate text-xs text-slate-500">{d.description || 'Chưa có mô tả'}</span>
                </span>
                <span className="hidden items-center gap-2.5 text-xs tabular-nums text-slate-500 md:flex">
                  <Count icon={ClipboardList} value={d.counts.masterTasks} label="nhiệm vụ thường kỳ" />
                  <Count icon={Users} value={d.counts.secretaries} label="thư ký" />
                  <Count icon={Handshake} value={d.counts.mous} label="MOU" />
                  <Count icon={ShieldCheck} value={d.counts.licenses} label="giấy phép" />
                </span>
                <button type="button" onClick={() => setMode({ kind: 'form', department: d })} className={cn(ICON_BTN, 'hover:text-brand-700')} aria-label={`Sửa ${d.name}`} title="Sửa">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setDeleteTarget(d)} className={cn(ICON_BTN, 'hover:bg-rose-50 hover:text-rose-600')} aria-label={`Xoá ${d.name}`} title="Xoá">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </ModalShell>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xoá phòng ban"
        message={`Bạn có chắc muốn xoá phòng "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function Count({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${value} ${label}`}>
      <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      {value}
    </span>
  );
}
