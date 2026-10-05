'use client';

/**
 * Phần "sổ tiếp đoàn" của lượt tiếp đoàn: thời gian kéo dài, khoa/phòng chủ trì,
 * văn bản đến, thành phần hai bên, chủ đề, quà và kinh phí, đánh dấu cần xác minh.
 * Tách khỏi InteractionModal cho gọn; mọi trường đều không bắt buộc.
 */
import useSWR from 'swr';
import { Select } from '@/components/ui/Select';
import { DELEGATION_TOPICS } from '@/lib/crm/constants';
import type { InteractionInput } from '@/lib/crm/schemas';
import { cleanText, toInt } from './format';
import type { InteractionDTO } from './types';
import { ChipGroup, Field, inputClass } from './ui';
import { DateInput } from '@/components/ui/DateInput';

export interface DelegationDetails {
  endAt: string;
  timeText: string;
  incomingDocNo: string;
  hostDepartmentId: string;
  /** Tên đơn vị chủ trì như ghi nhận, khi chưa khớp danh mục khoa/phòng. */
  hostUnit: string;
  hospitalAttendees: string;
  guestMembers: string;
  topics: string[];
  coOrganizations: string;
  giftsGiven: string;
  giftsReceived: string;
  cashReceived: string;
  giftBudget: string;
  giftActualCost: string;
  needsReview: boolean;
  reviewNote: string;
}

const money = (v: number | null) => (v == null ? '' : String(v));
const parseMoney = (v: string) => toInt(v.replace(/[.\s,]/g, ''));

export function detailsFrom(i: InteractionDTO | null): DelegationDetails {
  return {
    endAt: i?.endAt ? new Date(i.endAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) : '',
    timeText: i?.timeText ?? '',
    incomingDocNo: i?.incomingDocNo ?? '',
    hostDepartmentId: i?.hostDepartmentId ?? '',
    hostUnit: i?.hostDepartmentId ? '' : i?.hostUnit ?? '',
    hospitalAttendees: i?.hospitalAttendees ?? '',
    guestMembers: i?.guestMembers ?? '',
    topics: i?.topics ?? [],
    coOrganizations: i?.coOrganizations.join('; ') ?? '',
    giftsGiven: i?.giftsGiven ?? '',
    giftsReceived: i?.giftsReceived ?? '',
    cashReceived: money(i?.cashReceived ?? null),
    giftBudget: money(i?.giftBudget ?? null),
    giftActualCost: money(i?.giftActualCost ?? null),
    needsReview: i?.needsReview ?? false,
    reviewNote: i?.reviewNote ?? '',
  };
}

type DetailsBody = Pick<
  InteractionInput,
  | 'endAt' | 'timeText' | 'incomingDocNo' | 'hostDepartmentId' | 'hostUnit' | 'hospitalAttendees' | 'guestMembers' | 'topics'
  | 'coOrganizations' | 'giftsGiven' | 'giftsReceived' | 'cashReceived' | 'giftBudget' | 'giftActualCost' | 'needsReview' | 'reviewNote'
>;

export function detailsBody(d: DelegationDetails): DetailsBody {
  return {
    endAt: d.endAt || undefined,
    timeText: cleanText(d.timeText),
    incomingDocNo: cleanText(d.incomingDocNo),
    hostDepartmentId: d.hostDepartmentId || undefined,
    hostUnit: d.hostDepartmentId ? undefined : cleanText(d.hostUnit),
    hospitalAttendees: cleanText(d.hospitalAttendees),
    guestMembers: cleanText(d.guestMembers),
    topics: d.topics,
    coOrganizations: d.coOrganizations.split(';').map((s) => s.trim()).filter(Boolean),
    giftsGiven: cleanText(d.giftsGiven),
    giftsReceived: cleanText(d.giftsReceived),
    cashReceived: parseMoney(d.cashReceived),
    giftBudget: parseMoney(d.giftBudget),
    giftActualCost: parseMoney(d.giftActualCost),
    needsReview: d.needsReview,
    reviewNote: cleanText(d.reviewNote),
  };
}

export function validateDetails(d: DelegationDetails, occurredAt: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (d.endAt && occurredAt && d.endAt < occurredAt.slice(0, 10)) errors.endAt = 'Ngày kết thúc không được trước ngày bắt đầu';
  for (const key of ['cashReceived', 'giftBudget', 'giftActualCost'] as const) {
    if (d[key].trim() && parseMoney(d[key]) === undefined) errors[key] = 'Nhập số tiền (đồng), vd 5000000';
  }
  return errors;
}

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : []));

export function DelegationDetailsFields({ value, onChange, errors }: { value: DelegationDetails; onChange: (v: DelegationDetails) => void; errors: Record<string, string> }) {
  const { data: departments } = useSWR<Array<{ id: string; name: string }>>('/api/departments', fetcher, { revalidateOnFocus: false });
  const set = <K extends keyof DelegationDetails>(key: K, v: DelegationDetails[K]) => onChange({ ...value, [key]: v });
  const text = (key: keyof DelegationDetails, label: string, placeholder?: string, hint?: string) => (
    <Field label={label} error={errors[key]} hint={hint}>
      <input value={value[key] as string} onChange={(e) => set(key, e.target.value as never)} className={inputClass(errors[key])} placeholder={placeholder} />
    </Field>
  );
  const area = (key: keyof DelegationDetails, label: string, placeholder?: string) => (
    <Field label={label} error={errors[key]}>
      <textarea rows={2} value={value[key] as string} onChange={(e) => set(key, e.target.value as never)} className={inputClass(errors[key], 'resize-none')} placeholder={placeholder} />
    </Field>
  );

  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/50 open:bg-white" open={Boolean(value.hostDepartmentId || value.hostUnit || value.topics.length || value.needsReview)}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 marker:hidden">
        Sổ tiếp đoàn: chủ trì, thành phần, chủ đề, quà <span className="font-normal text-slate-500">(không bắt buộc)</span>
      </summary>
      <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-3">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Đến ngày" error={errors.endAt} hint="Đoàn làm việc nhiều ngày">
            <DateInput type="date" value={value.endAt} onChange={(e) => set('endAt', e.target.value)} className={inputClass(errors.endAt)} />
          </Field>
          {text('timeText', 'Giờ (như ghi nhận)', 'vd 09g00-09g30')}
          {text('incomingDocNo', 'Số văn bản đến', 'vd 1234/SYT-NVY')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Khoa/phòng chủ trì" htmlFor="ix-host">
            <Select id="ix-host" value={value.hostDepartmentId} onChange={(e) => onChange({ ...value, hostDepartmentId: e.target.value, hostUnit: '' })} className="px-3.5 py-2.5">
              <option value="">{value.hostUnit ? `Chưa khớp danh mục: ${value.hostUnit}` : 'Chọn khoa/phòng'}</option>
              {(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          {text('coOrganizations', 'Đơn vị đi cùng', 'Ngăn bởi dấu ;')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {area('hospitalAttendees', 'Thành phần tiếp (Bệnh viện)', 'Người tiếp, ngăn bởi dấu ;')}
          {area('guestMembers', 'Thành phần đoàn khách', 'Thành viên đoàn, ngăn bởi dấu ;')}
        </div>
        <ChipGroup legend="Chủ đề làm việc" options={[...DELEGATION_TOPICS, ...value.topics.filter((t) => !(DELEGATION_TOPICS as readonly string[]).includes(t))]} value={value.topics} onChange={(next) => set('topics', next)} />
        <div className="grid gap-4 sm:grid-cols-2">
          {area('giftsGiven', 'Quà Bệnh viện tặng')}
          {area('giftsReceived', 'Quà khách tặng')}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {text('cashReceived', 'Tiền mặt khách tặng (đồng)', 'vd 5000000')}
          {text('giftBudget', 'Dự trù kinh phí quà (đồng)')}
          {text('giftActualCost', 'Chi phí quà thực tế (đồng)')}
        </div>
        <div className="rounded-xl bg-amber-50/60 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <input type="checkbox" checked={value.needsReview} onChange={(e) => set('needsReview', e.target.checked)} className="h-4 w-4 rounded border-amber-400 text-amber-600" />
            Cần xác minh dữ liệu
          </label>
          {value.needsReview && (
            <textarea rows={2} value={value.reviewNote} onChange={(e) => set('reviewNote', e.target.value)} className={inputClass(undefined, 'mt-2 resize-none bg-white')} placeholder="Điểm cần xác minh" aria-label="Điểm cần xác minh" />
          )}
        </div>
      </div>
    </details>
  );
}
