'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CalendarDays, ChevronDown, ChevronUp, Sparkles, UsersRound } from 'lucide-react';
import { MeetingRoomSelector } from '@/components/hospital-events/MeetingRoomSelector';
import { Select } from '@/components/ui/Select';
import { VIP_STAFF } from '@/lib/vip';

interface ChecklistTemplate { id: string; title: string }

export default function NewHospitalEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [formData, setFormData] = useState({
    name: '', date: '', time: '', eventType: 'ORGANIZED' as 'ORGANIZED' | 'COLLABORATED',
    chair: '', description: '', meetingRoomId: null as string | null,
    participants: '', note: '', status: 'UNCONFIRMED' as 'CONFIRMED' | 'UNCONFIRMED',
  });

  useEffect(() => {
    fetch('/api/checklist-templates').then((response) => response.ok ? response.json() : []).then(setTemplates).catch(() => undefined);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/hospital-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          date: new Date(`${formData.date}T00:00:00`).toISOString(),
          time: formData.time || undefined,
          chair: formData.chair || undefined,
          description: formData.description || undefined,
          meetingRoomId: formData.meetingRoomId || undefined,
          participants: formData.participants || undefined,
          note: formData.note || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Không thể tạo sự kiện');
      router.push(`/dashboard/hospital-events/${data.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể tạo sự kiện');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="mb-3 text-sm font-medium text-cyan-700 hover:text-cyan-800">← Quay lại danh sách</button>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tạo sự kiện</h1>
        <p className="mt-2 text-slate-500">Chỉ cần 4 thông tin để tạo. Những phần còn lại có thể bổ sung sau.</p>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><Sparkles className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Thông tin để bắt đầu</h2><p className="text-sm text-slate-500">Các trường có dấu * là bắt buộc.</p></div></div>
          <div className="space-y-5">
            <Field label="Tên sự kiện" required><input required autoFocus value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="input" placeholder="Ví dụ: Hội nghị khoa học kỹ thuật năm 2026" /></Field>
            <Field label="Vai trò của phòng" required>
              <div className="grid gap-3 sm:grid-cols-2">
                <RoleCard active={formData.eventType === 'ORGANIZED'} icon={Building2} title="Chủ trì tổ chức" description="Phòng chịu trách nhiệm tổ chức chính" onClick={() => setFormData({ ...formData, eventType: 'ORGANIZED' })} />
                <RoleCard active={formData.eventType === 'COLLABORATED'} icon={UsersRound} title="Phối hợp tổ chức" description="Phòng hỗ trợ đơn vị chủ trì" onClick={() => setFormData({ ...formData, eventType: 'COLLABORATED' })} />
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ngày diễn ra" required><input required type="date" value={formData.date} onChange={(event) => setFormData({ ...formData, date: event.target.value })} className="input" /></Field>
              <Field label="Giờ"><input type="time" value={formData.time} onChange={(event) => setFormData({ ...formData, time: event.target.value })} className="input" /></Field>
              <Field label="Nhân viên đầu mối" required><Select required value={formData.chair} onChange={(event) => setFormData({ ...formData, chair: event.target.value })} className="px-3.5 py-2.5"><option value="">Chọn nhân viên</option>{VIP_STAFF.map((name) => <option key={name} value={name}>{name}</option>)}</Select></Field>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <button type="button" onClick={() => setShowDetails((current) => !current)} className="flex w-full items-center justify-between p-5 text-left hover:bg-slate-50 sm:px-6">
            <div><h2 className="font-bold text-slate-900">Thông tin bổ sung</h2><p className="mt-1 text-sm text-slate-500">Phòng họp, thành phần, mô tả và ghi chú — không bắt buộc.</p></div>
            {showDetails ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>
          {showDetails && <div className="space-y-5 border-t border-slate-100 p-5 sm:p-6">
            <Field label="Mô tả / mục tiêu sự kiện"><textarea rows={3} value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} className="input resize-none" placeholder="Nội dung chính hoặc kết quả mong muốn" /></Field>
            <Field label="Phòng họp"><MeetingRoomSelector value={formData.meetingRoomId} onChange={(meetingRoomId) => setFormData({ ...formData, meetingRoomId })} /></Field>
            <Field label={formData.eventType === 'COLLABORATED' ? 'Đơn vị chủ trì và thành phần phối hợp' : 'Đơn vị, nhân sự phối hợp'}><textarea rows={3} value={formData.participants} onChange={(event) => setFormData({ ...formData, participants: event.target.value })} className="input resize-none" placeholder={formData.eventType === 'COLLABORATED' ? 'Ghi đơn vị chủ trì trước, sau đó các đơn vị tham gia' : 'Các khoa/phòng hoặc cá nhân cùng thực hiện'} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Xác nhận lịch"><Select value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value as 'CONFIRMED' | 'UNCONFIRMED' })} className="px-3.5 py-2.5"><option value="UNCONFIRMED">Chưa xác nhận</option><option value="CONFIRMED">Đã xác nhận</option></Select></Field><Field label="Ghi chú"><textarea rows={2} value={formData.note} onChange={(event) => setFormData({ ...formData, note: event.target.value })} className="input resize-none" placeholder="Không bắt buộc" /></Field></div>
          </div>}
        </section>

        {templates.length > 0 && <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>{templates.length} công việc mẫu</strong> sẽ được thêm tự động sau khi tạo. Bạn có thể xem, hoàn thành hoặc chỉnh sửa tại trang chi tiết sự kiện.</p></div>}

        <div className="flex justify-end gap-3"><button type="button" onClick={() => router.back()} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white">Hủy</button><button disabled={loading} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-cyan-500/20 disabled:opacity-50">{loading ? 'Đang tạo...' : 'Tạo sự kiện'}</button></div>
      </form>
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>;
}

function RoleCard({ active, icon: Icon, title, description, onClick }: { active: boolean; icon: typeof Building2; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${active ? 'border-cyan-500 bg-cyan-50 ring-4 ring-cyan-500/10' : 'border-slate-200 hover:border-cyan-200 hover:bg-slate-50'}`}><div className={`rounded-xl p-2 ${active ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-5 w-5" /></div><div><p className="font-bold text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div></button>;
}
