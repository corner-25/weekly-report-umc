'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Handshake, ListChecks, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { ErrorBanner, PANEL, PRIMARY_BTN, SECONDARY_BTN } from '@/components/crm/ui';
import { computePortfolio } from '@/lib/mou/portfolio';
import { usePortfolio } from '@/components/mous/portfolio/usePortfolio';
import { PortfolioKpis } from '@/components/mous/portfolio/PortfolioKpis';
import { DecisionBoard } from '@/components/mous/portfolio/DecisionBoard';
import { DepartmentBoard } from '@/components/mous/portfolio/DepartmentBoard';
import { PortfolioMix } from '@/components/mous/portfolio/PortfolioMix';
import { EffectivenessBoard } from '@/components/mous/portfolio/EffectivenessBoard';
import { ManagementGuide } from '@/components/mous/portfolio/ManagementGuide';
import { MouDetailHost, type HostMode } from '@/components/mous/portfolio/MouDetailHost';

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className={cn(PANEL, 'h-[232px] animate-pulse bg-slate-50')} />
      <div className={cn(PANEL, 'h-80 animate-pulse bg-slate-50')} />
    </div>
  );
}

/**
 * Bảng điều hành hợp tác: lãnh đạo nhìn MOU nào thật sự có kết quả, MOU nào ký
 * rồi để đó, MOU nào cần quyết gia hạn, MOU nào chờ ký, phòng nào đang giữ gì.
 */
function MouDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const departmentId = params.get('phong') ?? '';
  const { views, departments, isLoading, error, reload } = usePortfolio();
  const [mode, setMode] = useState<HostMode>(() => {
    const id = params.get('id');
    return id ? { kind: 'view', id } : { kind: 'none' };
  });

  const scoped = useMemo(() => (departmentId ? views.filter((v) => (departmentId === 'none' ? !v.departmentId : v.departmentId === departmentId)) : views), [views, departmentId]);
  const data = useMemo(() => (scoped.length || !isLoading ? computePortfolio(scoped, new Date()) : null), [scoped, isLoading]);
  const ownerIds = useMemo(() => new Set(views.map((v) => v.departmentId).filter(Boolean)), [views]);

  const listHref = (extra: Record<string, string>) => {
    const q = new URLSearchParams(extra);
    if (departmentId && !extra.phong) q.set('phong', departmentId);
    return `/dashboard/mous/list?${q.toString()}`;
  };
  const setScope = (id: string) => {
    const q = new URLSearchParams(params.toString());
    if (id) q.set('phong', id);
    else q.delete('phong');
    q.delete('id');
    router.replace(q.toString() ? `${pathname}?${q.toString()}` : pathname, { scroll: false });
  };
  const scopeName = departments.find((d) => d.id === departmentId)?.name ?? (departmentId === 'none' ? 'MOU chưa có phòng đầu mối' : 'toàn bệnh viện');

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Handshake}
        title="Điều hành hợp tác (MOU)"
        description={`Ký kết, triển khai và gia hạn — ${scopeName}`}
        className="flex-wrap gap-4"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={listHref({ view: 'all' })} className={SECONDARY_BTN}>
              <ListChecks className="h-4 w-4" aria-hidden="true" /> Danh sách MOU
            </Link>
            <button type="button" onClick={() => setMode({ kind: 'create' })} className={PRIMARY_BTN}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Thêm MOU
            </button>
          </div>
        }
      />

      <div className={cn(PANEL, 'flex flex-wrap items-center gap-3 px-4 py-3')}>
        <span className="text-sm font-medium text-slate-600">Phòng đầu mối</span>
        <div className="w-full sm:w-72">
        <Select value={departmentId} onChange={(e) => setScope(e.target.value)} aria-label="Phòng đầu mối" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Toàn bệnh viện</option>
          {departments.filter((d) => ownerIds.has(d.id)).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
          <option value="none">Chưa có phòng đầu mối</option>
        </Select>
        </div>
        <span className="ml-auto text-xs text-slate-500">Số liệu từ phân hệ MOU, cào từ office.umc.edu.vn</span>
      </div>

      {error && <ErrorBanner message={error} />}
      {!data ? (
        <Skeleton />
      ) : (
        <>
          <PortfolioKpis data={data} listHref={(view) => listHref({ view })} />
          <EffectivenessBoard data={data} listHref={(extra) => listHref({ view: 'all', ...extra })} />
          <DecisionBoard lists={data.lists} onOpen={(id) => setMode({ kind: 'view', id })} listHref={(view) => listHref({ view })} />
          {!departmentId && <DepartmentBoard rows={data.departments} deptHref={(id, view = 'live') => listHref({ view, phong: id ?? 'none' })} />}
          <PortfolioMix data={data} listHref={listHref} />
          <ManagementGuide />
        </>
      )}

      <MouDetailHost mode={mode} onChange={setMode} departments={departments} onSaved={reload} />
    </div>
  );
}

export default function MouDashboardPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <MouDashboard />
    </Suspense>
  );
}
