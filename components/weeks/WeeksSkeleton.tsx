/** Khung chờ của trang danh sách báo cáo tuần. `embedded` = chỉ phần thân (đã có tiêu đề). */
export function WeeksSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-5" aria-busy="true" aria-label="Đang tải báo cáo tuần">
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-10 w-56 rounded-xl bg-slate-200" />
          <div className="h-10 w-64 rounded-xl bg-slate-200" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-40 rounded-2xl border border-slate-200 bg-white" />
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}
