export function Pagination({ page, total, onChange, disabled = false }: { page: number; total: number; onChange: (page: number) => void; disabled?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return <nav aria-label="Phân trang" className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm">
    <span>{total ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} / ${total}` : '0 kết quả'} · Trang {page}/{pages}</span>
    <div className="flex gap-2"><button type="button" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button type="button" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div>
  </nav>;
}
