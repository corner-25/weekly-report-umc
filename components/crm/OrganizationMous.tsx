'use client';

/** Hợp tác đã ký với tổ chức — nối sang phân hệ MOU để xem khía cạnh, bằng chứng, đánh giá. */
import Link from 'next/link';
import { Handshake } from 'lucide-react';
import { SectionCard } from './ui';
import type { OrganizationMou } from './types';
import { toView } from '@/lib/mou/portfolio';
import type { Verdict } from '@/lib/mou/assess';
import { LifecycleChip, fmtDate } from '@/components/mous/portfolio/terms';
import { VerdictChip } from '@/components/mous/MouReview';

export function OrganizationMous({ mous }: { mous: OrganizationMou[] }) {
  if (!mous.length) return null;
  const now = new Date();
  return (
    <SectionCard title="Hợp tác đã ký (MOU)" icon={<Handshake className="h-4 w-4 text-cyan-600" aria-hidden="true" />} action={<span className="text-xs text-slate-500">{mous.length} MOU</span>}>
      <ul className="-mx-2 divide-y divide-slate-100">
        {mous.map((m) => {
          const lifecycle = toView(
            {
              id: m.id, title: m.title, partnerName: '', partnerCountry: null, category: '', status: m.status, externalStatus: m.externalStatus,
              cooperationField: m.cooperationField, departmentId: null, departmentName: m.department, contactPerson: null,
              signedDate: m.signedDate, expiryDate: m.expiryDate, progress: null, clauseCount: m.aspects, documentCount: 0,
              activityCount: 0, lastActivityAt: null, updatedAt: now.toISOString(),
            },
            now,
          ).lifecycle;
          const verdict = (m.evaluation ?? m.aiVerdict) as Verdict | null;
          return (
            <li key={m.id}>
              <Link href={`/dashboard/mous/list?id=${m.id}`} className="block rounded-lg px-2 py-2.5 hover:bg-slate-50">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-900">{m.title}</span>
                  <LifecycleChip lifecycle={lifecycle} />
                  {verdict && <VerdictChip verdict={verdict} prefix={m.evaluation ? undefined : '✦ '} />}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Ký {fmtDate(m.signedDate)}
                  {m.expiryDate && ` · hết hạn ${fmtDate(m.expiryDate)}`}
                  {m.department && ` · ${m.department}`}
                  {m.aspects > 0 && ` · ${m.aspectsActive}/${m.aspects} khía cạnh đã triển khai`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
