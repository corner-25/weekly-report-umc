'use client';

import { useState, type FormEvent } from 'react';
import { Select } from '@/components/ui/Select';
import { useDepartments } from '@/lib/swr';
import { WORK_PRIORITY_LABELS, type WorkPriorityKey } from '@/lib/work/constants';
import { crmSend, errorMessage } from '@/components/crm/api';
import { cleanText } from '@/components/crm/format';
import { ErrorBanner, Field, PRIMARY_BTN, SectionCard, TagInput, inputClass } from '@/components/crm/ui';
import type { WorkItemDTO } from './types';

/**
 * B2: Phòng HC ghi tính chất, lưu ý của công việc — phần riêng của phòng, lần
 * cào sau không ghi đè. Ghi càng kỹ, AI gợi ý càng sát.
 */
export function CharacteristicsCard({ item, onSaved }: { item: WorkItemDTO; onSaved: (saved: WorkItemDTO) => void }) {
  const { data: departments } = useDepartments();
  const [priority, setPriority] = useState<WorkPriorityKey>(item.priority);
  const [tags, setTags] = useState(item.tags);
  const [characteristics, setCharacteristics] = useState(item.characteristics ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [departmentId, setDepartmentId] = useState(item.department?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await crmSend<WorkItemDTO>(`/api/work/items/${item.id}`, 'PATCH', {
        priority,
        tags,
        characteristics: cleanText(characteristics) ?? '',
        notes: cleanText(notes) ?? '',
        departmentId: departmentId || undefined,
      });
      setSavedAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      onSaved(saved);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Không lưu được.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Tính chất & lưu ý (Phòng HC ghi)">
      <form onSubmit={save} className="space-y-4">
        <ErrorBanner message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mức ưu tiên" htmlFor="wk-b2-priority">
            <Select id="wk-b2-priority" value={priority} onChange={(e) => setPriority(e.target.value as WorkPriorityKey)} className="px-3.5 py-2.5">
              {(Object.keys(WORK_PRIORITY_LABELS) as WorkPriorityKey[]).map((p) => <option key={p} value={p}>{WORK_PRIORITY_LABELS[p]}</option>)}
            </Select>
          </Field>
          <Field label="Đơn vị chủ trì (để nhắc đúng thư ký)" htmlFor="wk-b2-dept" hint={item.leadUnit && !item.department ? `Nguồn ghi "${item.leadUnit}" — chưa khớp phòng ban nào` : undefined}>
            <Select id="wk-b2-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="px-3.5 py-2.5">
              <option value="">Chưa chọn</option>
              {((departments as Array<{ id: string; name: string }> | undefined) ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Tính chất công việc" hint="Phạm vi, các bên liên quan, ràng buộc pháp lý, ngân sách, việc định kỳ hay một lần…">
          <textarea rows={3} value={characteristics} onChange={(e) => setCharacteristics(e.target.value)} className={inputClass(undefined, 'resize-y')} />
        </Field>
        <Field label="Lưu ý khi thực hiện" hint="Điều BGĐ nhấn mạnh, việc phải xin ý kiến, mốc nội bộ…">
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass(undefined, 'resize-y')} />
        </Field>
        <TagInput label="Nhãn" value={tags} onChange={setTags} />
        <div className="flex items-center justify-end gap-3">
          {savedAt && <span className="text-xs text-slate-500">Đã lưu lúc {savedAt}</span>}
          <button type="submit" disabled={saving} className={PRIMARY_BTN}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </form>
    </SectionCard>
  );
}
