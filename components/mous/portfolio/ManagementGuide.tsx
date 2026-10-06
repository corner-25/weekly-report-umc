'use client';

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { DORMANT_MONTHS, EXPIRING_DAYS } from '@/lib/mou/portfolio';
import { MOU_TERMS, type MouTermKey } from './terms';

/** Chu trình quản lý một MOU — để mọi phòng đầu mối hiểu lãnh đạo nhìn vào đâu. */
const CYCLE = [
  { step: 'Chờ ký', text: 'Phòng đầu mối trình tờ trình, theo dõi đến khi hai bên ký; ghi ngày hết hạn và tải bản ký lên ngay.' },
  { step: 'Triển khai', text: 'Mỗi MOU có người phụ trách, cập nhật % tiến độ và ghi hoạt động thực tế (đào tạo, hội thảo, trao đổi chuyên gia…).' },
  { step: 'Rà soát', text: `Ký quá ${DORMANT_MONTHS} tháng mà chưa có kết quả thì phòng đầu mối giải trình: thúc đẩy hay đề xuất dừng.` },
  { step: 'Gia hạn hoặc kết thúc', text: `${EXPIRING_DAYS} ngày trước khi hết hạn, phòng đầu mối báo cáo hiệu quả để lãnh đạo quyết gia hạn, ký mới hay kết thúc.` },
];

const GROUPS: Array<{ title: string; terms: MouTermKey[] }> = [
  { title: 'Hiệu lực và triển khai', terms: ['live', 'started', 'implementationRate', 'avgProgress', 'signedThisYear'] },
  { title: 'Cần xử lý', terms: ['dormant', 'decide', 'pending', 'incomplete', 'noTerm'] },
  { title: 'Nhóm', terms: ['department', 'field', 'international', 'ended'] },
];

export function ManagementGuide() {
  return (
    <details className={cn(PANEL, 'group p-4 sm:p-5')}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-slate-900 marker:hidden">
        <Info className="h-4 w-4 text-brand-600" aria-hidden="true" />
        Cách quản lý MOU và giải thích thuật ngữ
        <span className="ml-auto text-xs font-medium text-slate-500 group-open:hidden">Mở</span>
        <span className="ml-auto hidden text-xs font-medium text-slate-500 group-open:inline">Thu gọn</span>
      </summary>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CYCLE.map((c, i) => (
          <li key={c.step} className="rounded-xl bg-slate-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">{i + 1}</span>
              {c.step}
            </p>
            <p className="mt-1.5 text-sm text-slate-600">{c.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{g.title}</h3>
            <dl className="space-y-2 text-sm">
              {g.terms.map((k) => (
                <div key={k}>
                  <dt className="font-semibold text-slate-800">{MOU_TERMS[k].label}</dt>
                  <dd className="text-slate-600">{MOU_TERMS[k].def}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </details>
  );
}
