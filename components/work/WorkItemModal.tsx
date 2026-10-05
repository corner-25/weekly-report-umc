'use client';

import { useState, type FormEvent } from 'react';
import { Select } from '@/components/ui/Select';
import { useDepartments } from '@/lib/swr';
import { WORK_KIND_LABELS, WORK_PRIORITY_LABELS, WORK_STATUS_LABELS, type WorkKindKey, type WorkPriorityKey, type WorkStatusKey } from '@/lib/work/constants';
import { CrmApiError, crmSend, errorMessage } from '@/components/crm/api';
import { cleanText, toInt } from '@/components/crm/format';
import { ErrorBanner, Field, ModalFooter, ModalShell, TagInput, inputClass } from '@/components/crm/ui';
import type { WorkItemDTO } from './types';
import { DateInput } from '@/components/ui/DateInput';

interface WorkItemModalProps {
  /** Sửa việc tự mở; bỏ trống là mở việc mới. */
  initial?: WorkItemDTO;
  onClose: () => void;
  onSaved: (saved: WorkItemDTO) => void;
}

/** Mở hoặc sửa việc Phòng HC tự theo dõi (thường là việc theo kế hoạch). */
export function WorkItemModal({ initial, onClose, onSaved }: WorkItemModalProps) {
  const { data: departments } = useDepartments();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [kind, setKind] = useState<WorkKindKey>(initial?.kind ?? 'PLAN');
  const [directedBy, setDirectedBy] = useState(initial?.directedBy ?? '');
  const [departmentId, setDepartmentId] = useState(initial?.department?.id ?? '');
  const [assignees, setAssignees] = useState<string[]>(initial?.assignees ?? []);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [status, setStatus] = useState<WorkStatusKey>(initial?.status ?? 'NOT_STARTED');
  const [progress, setProgress] = useState(initial?.progressPercent != null ? String(initial.progressPercent) : '');
  const [priority, setPriority] = useState<WorkPriorityKey>(initial?.priority ?? 'NORMAL');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!title.trim()) clientErrors.title = 'Nhập tên công việc';
    const pct = toInt(progress);
    if (pct !== undefined && (pct < 0 || pct > 100)) clientErrors.progressPercent = 'Tiến độ từ 0 đến 100';
    setErrors(clientErrors);
    setBanner('');
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const unit = (departments as Array<{ id: string; name: string }> | undefined)?.find((d) => d.id === departmentId);
      const body = {
        title: title.trim(),
        description: initial ? description.trim() : cleanText(description),
        kind,
        directedBy: cleanText(directedBy),
        departmentId: departmentId || undefined,
        leadUnit: unit?.name,
        assignees,
        dueDate: dueDate || undefined,
        status,
        progressPercent: pct,
        priority,
      };
      const saved = initial
        ? await crmSend<WorkItemDTO>(`/api/work/items/${initial.id}`, 'PATCH', body)
        : await crmSend<WorkItemDTO>('/api/work/items', 'POST', body);
      onSaved(saved);
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) setErrors(error.fieldErrors);
      setBanner(errorMessage(error, 'Không lưu được công việc.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={initial ? 'Sửa công việc' : 'Mở việc theo kế hoạch'} subtitle="Việc chỉ đạo của BGĐ thường lấy tự động từ phân hệ Quản lý công việc." onClose={onClose} size="md">
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />
        <Field label="Tên công việc" required error={errors.title}>
          <input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass(errors.title)} placeholder="Tổ chức hội nghị tổng kết năm 2026" />
        </Field>
        <Field label="Nội dung, yêu cầu" error={errors.description}>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass(errors.description, 'resize-none')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loại" htmlFor="wk-kind">
            <Select id="wk-kind" value={kind} onChange={(e) => setKind(e.target.value as WorkKindKey)} className="px-3.5 py-2.5">
              {(Object.keys(WORK_KIND_LABELS) as WorkKindKey[]).map((k) => <option key={k} value={k}>{WORK_KIND_LABELS[k]}</option>)}
            </Select>
          </Field>
          <Field label="Người chỉ đạo / giao việc" error={errors.directedBy}>
            <input value={directedBy} onChange={(e) => setDirectedBy(e.target.value)} className={inputClass(errors.directedBy)} />
          </Field>
          <Field label="Đơn vị chủ trì" htmlFor="wk-dept">
            <Select id="wk-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="px-3.5 py-2.5">
              <option value="">Chưa chọn</option>
              {((departments as Array<{ id: string; name: string }> | undefined) ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Hạn chót" error={errors.dueDate}>
            <DateInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass(errors.dueDate)} />
          </Field>
          <Field label="Trạng thái" htmlFor="wk-status">
            <Select id="wk-status" value={status} onChange={(e) => setStatus(e.target.value as WorkStatusKey)} className="px-3.5 py-2.5">
              {(Object.keys(WORK_STATUS_LABELS) as WorkStatusKey[]).map((s) => <option key={s} value={s}>{WORK_STATUS_LABELS[s]}</option>)}
            </Select>
          </Field>
          <Field label="Tiến độ (%)" error={errors.progressPercent}>
            <input type="number" inputMode="numeric" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} className={inputClass(errors.progressPercent)} />
          </Field>
          <Field label="Mức ưu tiên" htmlFor="wk-priority">
            <Select id="wk-priority" value={priority} onChange={(e) => setPriority(e.target.value as WorkPriorityKey)} className="px-3.5 py-2.5">
              {(Object.keys(WORK_PRIORITY_LABELS) as WorkPriorityKey[]).map((p) => <option key={p} value={p}>{WORK_PRIORITY_LABELS[p]}</option>)}
            </Select>
          </Field>
        </div>
        <TagInput label="Người thực hiện" value={assignees} onChange={setAssignees} error={errors.assignees} />
        <ModalFooter onCancel={onClose} saving={saving} submitLabel={initial ? 'Lưu thay đổi' : 'Mở việc'} />
      </form>
    </ModalShell>
  );
}
