'use client';

/**
 * Hồ sơ phòng ban: bảng điều hành của một phòng (công việc chỉ đạo, nộp báo cáo,
 * nhiệm vụ báo cáo tuần, số liệu) và thông tin phòng (thư ký, giấy phép, MOU).
 * Dữ liệu: /api/departments/[id]/profile — xem lib/department-profile.ts.
 */
import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { crmFetch } from '@/components/crm/api';
import { EmptyState, ErrorBanner } from '@/components/crm/ui';
import { DepartmentFormModal } from '@/components/departments/DepartmentForm';
import { MetricsSection } from '@/components/departments/MetricsSection';
import { PeopleSection } from '@/components/departments/PeopleSection';
import { BackLink, ProfileHeader } from '@/components/departments/ProfileHeader';
import { ProfileKpis } from '@/components/departments/ProfileKpis';
import { ReportSection } from '@/components/departments/ReportSection';
import { WorkSection } from '@/components/departments/WorkSection';
import type { DepartmentProfile } from '@/lib/department-profile';

export default function DepartmentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<DepartmentProfile>(`/api/departments/${id}/profile`, (url: string) => crmFetch<DepartmentProfile>(url), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        {(error as { status?: number }).status === 404 ? <EmptyState title="Không tìm thấy phòng ban" hint="Phòng có thể đã bị xoá." /> : <ErrorBanner message={error.message} />}
      </div>
    );
  }
  if (isLoading || !data) return <ProfileSkeleton />;

  return (
    <div className="space-y-4 animate-page-in sm:space-y-5">
      <BackLink />
      <ProfileHeader data={data} onEdit={() => setEditing(true)} />
      <ProfileKpis data={data} />
      <WorkSection data={data} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ReportSection data={data} />
        <MetricsSection data={data} />
      </div>
      <PeopleSection data={data} />

      {editing && (
        <DepartmentFormModal
          department={data.department}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            // Hồ sơ được trình duyệt giữ 60 giây — cập nhật tại chỗ thay vì tải lại.
            void mutate({ ...data, department: { ...data.department, name: saved.name, description: saved.description } }, { revalidate: false });
          }}
        />
      )}
    </div>
  );
}

/** Khung chờ đúng bố cục thật — trang không nhảy khi dữ liệu về. */
function ProfileSkeleton() {
  const block = 'animate-pulse rounded-2xl bg-slate-200/70';
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Đang tải hồ sơ phòng ban">
      <BackLink />
      <div className={cn(block, 'h-36')} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className={cn(block, 'h-24')} />)}</div>
      <div className={cn(block, 'h-[420px]')} />
      <div className="grid gap-4 lg:grid-cols-2"><div className={cn(block, 'h-96')} /><div className={cn(block, 'h-96')} /></div>
    </div>
  );
}
