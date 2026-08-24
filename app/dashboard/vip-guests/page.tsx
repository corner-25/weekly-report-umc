'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Building2, Crown, Pencil, Phone, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { VIP_STAFF } from '@/lib/vip';

interface Organization { id: string; name: string }
interface VipVisit {
  id: string;
  visitDate: string;
  guestName: string;
  organization?: Organization | null;
  phone?: string | null;
  contactInfo?: string | null;
  supportContent: string;
  destination?: string | null;
  staffName: string;
  note?: string | null;
}

const emptyForm = {
  visitDate: format(new Date(), 'yyyy-MM-dd'),
  guestName: '',
  organizationName: '',
  phone: '',
  contactInfo: '',
  supportContent: '',
  destination: '',
  staffName: '',
  note: '',
};

export default function VipGuestsPage() {
  const [visits, setVisits] = useState<VipVisit[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VipVisit | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (staffFilter) params.set('staffName', staffFilter);
      const [visitRes, organizationRes] = await Promise.all([
        fetch(`/api/vip-visits?${params}`),
        fetch('/api/vip-organizations'),
      ]);
      if (!visitRes.ok || !organizationRes.ok) throw new Error();
      setVisits(await visitRes.json());
      setOrganizations(await organizationRes.json());
    } catch {
      setError('Không thể tải dữ liệu khách VIP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [search, staffFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return visits.filter((visit) => {
      const date = new Date(visit.visitDate);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [visits]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, visitDate: format(new Date(), 'yyyy-MM-dd') });
    setShowForm(true);
  };

  const openEdit = (visit: VipVisit) => {
    setEditingId(visit.id);
    setForm({
      visitDate: format(new Date(visit.visitDate), 'yyyy-MM-dd'),
      guestName: visit.guestName,
      organizationName: visit.organization?.name ?? '',
      phone: visit.phone ?? '',
      contactInfo: visit.contactInfo ?? '',
      supportContent: visit.supportContent,
      destination: visit.destination ?? '',
      staffName: visit.staffName,
      note: visit.note ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(editingId ? `/api/vip-visits/${editingId}` : '/api/vip-visits', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          visitDate: new Date(`${form.visitDate}T00:00:00`).toISOString(),
          organizationName: form.organizationName || undefined,
          phone: form.phone || undefined,
          contactInfo: form.contactInfo || undefined,
          destination: form.destination || undefined,
          note: form.note || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể lưu dữ liệu');
      setShowForm(false);
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể lưu dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/vip-visits/${deleteTarget.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setDeleteTarget(null);
      await loadData();
    } catch {
      setError('Không thể xóa lượt tiếp đón.');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa lượt tiếp đón"
        message={`Bạn có chắc muốn xóa lượt tiếp đón của “${deleteTarget?.guestName ?? ''}”?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <PageHeader
        icon={Crown}
        title="Khách VIP"
        description="Ghi nhận khách được tiếp đón, hướng dẫn và phục vụ"
        actions={
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-cyan-500/20">
            <Plus className="h-4 w-4" /> Thêm lượt tiếp đón
          </button>
        }
      />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Tổng lượt đang hiển thị" value={visits.length} />
        <Stat label="Trong tháng này" value={thisMonthCount} />
        <Stat label="Cơ quan đã ghi nhớ" value={organizations.length} />
        <Stat label="Nhân viên phụ trách" value={VIP_STAFF.length} />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_280px]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên khách, cơ quan, nội dung hỗ trợ..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
          </div>
          <Select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="px-3.5 py-2.5">
            <option value="">Tất cả nhân viên</option>
            {VIP_STAFF.map((name) => <option key={name} value={name}>{name}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Đang tải dữ liệu...</div>
        ) : visits.length === 0 ? (
          <div className="p-12 text-center">
            <Crown className="mx-auto mb-3 h-12 w-12 text-slate-200" />
            <p className="font-semibold text-slate-700">Chưa có lượt tiếp đón phù hợp</p>
            <p className="mt-1 text-sm text-slate-500">Thêm bản ghi đầu tiên hoặc thay đổi điều kiện tìm kiếm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Ngày</th><th className="px-5 py-3">Khách & liên hệ</th><th className="px-5 py-3">Cơ quan</th><th className="px-5 py-3">Nội dung hỗ trợ</th><th className="px-5 py-3">Phụ trách</th><th className="px-5 py-3 text-right">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.map((visit) => (
                  <tr key={visit.id} className="align-top hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-700">{format(new Date(visit.visitDate), 'dd/MM/yyyy', { locale: vi })}</td>
                    <td className="px-5 py-4"><p className="font-semibold text-slate-900">{visit.guestName}</p>{visit.phone && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3 w-3" />{visit.phone}</p>}{visit.contactInfo && <p className="mt-1 text-xs text-slate-500">{visit.contactInfo}</p>}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{visit.organization?.name || '—'}</td>
                    <td className="max-w-sm px-5 py-4"><p className="text-sm text-slate-700">{visit.supportContent}</p>{visit.destination && <p className="mt-1 text-xs text-slate-500">Nơi đến: {visit.destination}</p>}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-700">{visit.staffName}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-1"><button onClick={() => openEdit(visit)} title="Sửa" className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50"><Pencil className="h-4 w-4" /></button><button onClick={() => setDeleteTarget(visit)} title="Xóa" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
              <div><h2 className="text-xl font-bold">{editingId ? 'Sửa lượt tiếp đón' : 'Thêm lượt tiếp đón VIP'}</h2><p className="mt-1 text-sm text-slate-500">Không có trạng thái hay quy trình; chỉ ghi nhận dữ liệu cần báo cáo.</p></div>
              <button onClick={() => setShowForm(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Đóng</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ngày tiếp đón" required><input required type="date" value={form.visitDate} onChange={(event) => setForm({ ...form, visitDate: event.target.value })} className="input" /></Field>
                <Field label="Tên khách" required><input required value={form.guestName} onChange={(event) => setForm({ ...form, guestName: event.target.value })} className="input" placeholder="Nhập họ và tên khách" /></Field>
              </div>
              <Field label="Cơ quan khách"><div className="relative"><Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input list="vip-organization-options" value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} className="input pl-10" placeholder="Chọn hoặc nhập cơ quan mới" /><datalist id="vip-organization-options">{organizations.map((organization) => <option key={organization.id} value={organization.name} />)}</datalist></div><p className="mt-1.5 text-xs text-slate-500">Cơ quan mới sẽ tự lưu vào danh mục sau khi bạn lưu bản ghi.</p></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Số điện thoại"><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="input" placeholder="Ví dụ: 0901 234 567" /></Field>
                <Field label="Thông tin liên lạc khác"><input value={form.contactInfo} onChange={(event) => setForm({ ...form, contactInfo: event.target.value })} className="input" placeholder="Email hoặc người liên hệ" /></Field>
              </div>
              <Field label="Nội dung hỗ trợ / dẫn bệnh" required><textarea required rows={3} value={form.supportContent} onChange={(event) => setForm({ ...form, supportContent: event.target.value })} className="input resize-none" placeholder="Ví dụ: Hướng dẫn khám và làm xét nghiệm tại Khoa Tim mạch" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Khoa/phòng hoặc nơi đến"><input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} className="input" placeholder="Nhập nơi khách đến" /></Field>
                <Field label="Nhân viên phụ trách" required><Select required value={form.staffName} onChange={(event) => setForm({ ...form, staffName: event.target.value })} className="px-3.5 py-2.5"><option value="">Chọn nhân viên</option>{VIP_STAFF.map((name) => <option key={name} value={name}>{name}</option>)}</Select></Field>
              </div>
              <Field label="Ghi chú"><textarea rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="input resize-none" placeholder="Không bắt buộc" /></Field>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-5"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600">Hủy</button><button disabled={saving} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Lưu lượt tiếp đón'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{value}</p></div>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>;
}
