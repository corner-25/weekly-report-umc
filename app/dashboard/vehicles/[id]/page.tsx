'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Truck, ArrowLeft, Wrench, Calendar, FileText, FileBadge, History,
  Plus, Loader2, Ambulance, Car, Bus, Package, HelpCircle,
} from 'lucide-react';

interface Vehicle {
  id: string;
  licensePlate: string;
  brand: string | null;
  model: string | null;
  category: string;
  color: string | null;
  engineNumber: string | null;
  chassisNumber: string | null;
  seatCount: string | null;
  payloadKg: string | null;
  curbWeightKg: string | null;
  totalWeightKg: string | null;
  manufactureYear: number | null;
  manufactureCountry: string | null;
  expiryYear: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  firstRegistrationDate: string | null;
  inspectionCertNumber: string | null;
  inspectionExpiry: string | null;
  insuranceExpiry: string | null;
  ownerName: string | null;
  ownerAddress: string | null;
  manager: string | null;
  dimensions: string | null;
  tireSpecification: string | null;
  wheelTrack: string | null;
  wheelbase: string | null;
  fuelType: string | null;
  engineType: string | null;
  displacement: string | null;
  maxPower: string | null;
  steeringSystem: string | null;
  transmission: string | null;
  brakeSystem: string | null;
  parkingBrake: string | null;
  airConditioning: string | null;
  status: string;
  rawHistory: string | null;
  sourceFile: string | null;
  license: { id: string; name: string; licenseNumber: string | null; expiryDate: string | null; fileUrl: string | null } | null;
  maintenanceLogs: MaintenanceLog[];
  relatedLicenses: Array<{ id: string; name: string; licenseNumber: string | null; category: string; expiryDate: string | null; issuedDate: string | null; scope: string | null; fileUrl: string | null }>;
}

interface MaintenanceLog {
  id: string;
  date: string | null;
  odometer: number | null;
  category: string | null;
  description: string;
  workshop: string | null;
  costAmount: number | string | null;
}

const CATEGORY_META: Record<string, { label: string; Icon: typeof Ambulance }> = {
  AMBULANCE: { label: 'Cứu thương', Icon: Ambulance },
  ADMIN_CAR: { label: 'Hành chính', Icon: Car },
  BUS: { label: 'Xe khách', Icon: Bus },
  TRUCK: { label: 'Xe tải', Icon: Truck },
  PICKUP: { label: 'Pickup', Icon: Package },
  OTHER: { label: 'Khác', Icon: HelpCircle },
};

type Tab = 'spec' | 'documents' | 'maintenance' | 'history';

const TABS: Array<{ key: Tab; label: string; Icon: typeof Wrench }> = [
  { key: 'spec', label: 'Thông số', Icon: FileBadge },
  { key: 'documents', label: 'Giấy tờ', Icon: FileText },
  { key: 'maintenance', label: 'Bảo dưỡng', Icon: Wrench },
  { key: 'history', label: 'Lịch sử .doc gốc', Icon: History },
];

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('spec');
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);

  const reload = async () => {
    const res = await fetch(`/api/vehicles/${id}`);
    if (res.ok) setVehicle(await res.json());
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto" />
      </div>
    );
  }
  if (!vehicle) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Không tìm thấy xe</p>
        <Link href="/dashboard/vehicles" className="text-cyan-600 hover:underline mt-2 inline-block">← Về danh sách</Link>
      </div>
    );
  }

  const meta = CATEGORY_META[vehicle.category] ?? CATEGORY_META.OTHER;
  const Icon = meta.Icon;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/vehicles" className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Danh sách phương tiện
      </Link>

      <PageHeader
        icon={Icon}
        title={`${vehicle.licensePlate} — ${[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}`}
        description={`${meta.label}${vehicle.manufactureYear ? ` · Năm SX ${vehicle.manufactureYear}` : ''}${vehicle.color ? ` · Màu ${vehicle.color}` : ''}`}
      />

      <nav className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const TabIcon = t.Icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                active ? 'text-cyan-700 border-b-2 border-cyan-500' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {t.label}
              {t.key === 'maintenance' && vehicle.maintenanceLogs.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-full">
                  {vehicle.maintenanceLogs.length}
                </span>
              )}
              {t.key === 'documents' && vehicle.relatedLicenses.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-full">
                  {vehicle.relatedLicenses.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'spec' && (
        <div className="space-y-4">
          <Section title="Thông tin chung">
            <KV label="Biển số" value={vehicle.licensePlate} />
            <KV label="Nhãn hiệu" value={vehicle.brand || '—'} />
            <KV label="Số loại" value={vehicle.model || '—'} />
            <KV label="Loại xe" value={meta.label} />
            <KV label="Màu sơn" value={vehicle.color || '—'} />
            <KV label="Năm sản xuất" value={vehicle.manufactureYear?.toString() || '—'} />
            <KV label="Nước sản xuất" value={vehicle.manufactureCountry || '—'} />
            <KV label="Niên hạn" value={vehicle.expiryYear || '—'} />
            <KV label="Số máy" value={vehicle.engineNumber || '—'} />
            <KV label="Số khung" value={vehicle.chassisNumber || '—'} />
            <KV label="Số chỗ" value={vehicle.seatCount || '—'} />
            <KV label="Tải trọng" value={vehicle.payloadKg || '—'} />
            <KV label="Tự trọng" value={vehicle.curbWeightKg || '—'} />
            <KV label="Trọng lượng toàn bộ" value={vehicle.totalWeightKg || '—'} />
          </Section>

          <Section title="Đăng ký & Quản lý">
            <KV label="Giấy đăng ký số" value={vehicle.registrationNumber || '—'} />
            <KV label="Ngày cấp giấy ĐK" value={fmtDate(vehicle.registrationDate)} />
            <KV label="Đăng ký lần đầu" value={fmtDate(vehicle.firstRegistrationDate)} />
            <KV label="Chứng nhận kiểm định" value={vehicle.inspectionCertNumber || '—'} />
            <KV label="Kiểm định hết hạn" value={fmtDate(vehicle.inspectionExpiry)} />
            <KV label="Bảo hiểm hết hạn" value={fmtDate(vehicle.insuranceExpiry)} />
            <KV label="Chủ xe" value={vehicle.ownerName || '—'} span2 />
            <KV label="Địa chỉ chủ xe" value={vehicle.ownerAddress || '—'} span2 />
            <KV label="Người quản lý phương tiện" value={vehicle.manager || '—'} span2 />
          </Section>

          <Section title="Thông số kỹ thuật">
            <KV label="Kích thước (D×R×C)" value={vehicle.dimensions || '—'} span2 />
            <KV label="Vết bánh trước/sau" value={vehicle.wheelTrack || '—'} />
            <KV label="Chiều dài cơ sở" value={vehicle.wheelbase || '—'} />
            <KV label="Sai vỏ" value={vehicle.tireSpecification || '—'} />
            <KV label="Nhiên liệu" value={vehicle.fuelType || '—'} />
            <KV label="Kiểu động cơ" value={vehicle.engineType || '—'} />
            <KV label="Dung tích" value={vehicle.displacement || '—'} />
            <KV label="Công suất max" value={vehicle.maxPower || '—'} />
            <KV label="Hệ thống lái" value={vehicle.steeringSystem || '—'} />
            <KV label="Hộp số" value={vehicle.transmission || '—'} />
            <KV label="Phanh chính" value={vehicle.brakeSystem || '—'} />
            <KV label="Phanh đỗ" value={vehicle.parkingBrake || '—'} />
            <KV label="Điều hòa" value={vehicle.airConditioning || '—'} span2 />
          </Section>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-3">
          {vehicle.relatedLicenses.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-12 text-center">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">Chưa có giấy tờ nào được gắn cho xe này</p>
            </div>
          )}
          {vehicle.relatedLicenses.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">{l.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-xs">
                    {l.licenseNumber && <KV label="Số" value={l.licenseNumber} />}
                    {l.issuedDate && <KV label="Ngày cấp" value={fmtDate(l.issuedDate)} />}
                    {l.expiryDate && <KV label="Hết hạn" value={fmtDate(l.expiryDate)} />}
                    <KV label="Loại" value={l.category} />
                  </div>
                  {l.scope && (
                    <div className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{l.scope}</div>
                  )}
                </div>
                {l.fileUrl && (
                  <a
                    href={l.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-3 py-1.5 text-xs font-medium text-cyan-600 border border-cyan-200 rounded-lg hover:bg-cyan-50"
                  >
                    Xem file
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddMaintenance(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700"
            >
              <Plus className="w-4 h-4" /> Thêm bảo dưỡng
            </button>
          </div>
          {vehicle.maintenanceLogs.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-12 text-center">
              <Wrench className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">Chưa có bảo dưỡng nào được ghi nhận</p>
              {vehicle.rawHistory && (
                <p className="text-xs text-slate-400 mt-2">Lịch sử thô từ file .doc còn nguyên — xem ở tab &quot;Lịch sử .doc gốc&quot;</p>
              )}
            </div>
          )}
          {vehicle.maintenanceLogs.map((log) => (
            <div key={log.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-3">
              <div className="shrink-0 w-12 text-center">
                <div className="text-[10px] text-slate-500 uppercase">{log.date ? new Date(log.date).toLocaleDateString('vi-VN', { month: 'short' }) : ''}</div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">{log.date ? new Date(log.date).getDate() : '—'}</div>
                <div className="text-[10px] text-slate-500">{log.date ? new Date(log.date).getFullYear() : ''}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {log.category && (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-cyan-100 text-cyan-700 rounded-full">
                      {log.category}
                    </span>
                  )}
                  {log.odometer && (
                    <span className="text-[11px] text-slate-500 tabular-nums">{log.odometer.toLocaleString('vi-VN')} km</span>
                  )}
                  {log.workshop && (
                    <span className="text-[11px] text-slate-500">@ {log.workshop}</span>
                  )}
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{log.description}</p>
                {log.costAmount && (
                  <p className="text-xs text-emerald-700 mt-1 font-medium">{Number(log.costAmount).toLocaleString('vi-VN')} đ</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          {vehicle.sourceFile && (
            <p className="text-xs text-slate-500 mb-2">Trích từ <code className="text-slate-700">{vehicle.sourceFile}</code></p>
          )}
          {vehicle.rawHistory ? (
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-[600px] overflow-y-auto">
              {vehicle.rawHistory}
            </pre>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Không có lịch sử thô được lưu</p>
          )}
        </div>
      )}

      {showAddMaintenance && (
        <AddMaintenanceModal
          vehicleId={vehicle.id}
          onClose={() => setShowAddMaintenance(false)}
          onSuccess={() => { setShowAddMaintenance(false); reload(); }}
        />
      )}
    </div>
  );
}

function AddMaintenanceModal({ vehicleId, onClose, onSuccess }: { vehicleId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ date: '', odometer: '', category: '', description: '', workshop: '', costAmount: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) { setError('Mô tả không được để trống'); return; }
    setLoading(true); setError('');
    const res = await fetch(`/api/vehicles/${vehicleId}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) onSuccess();
    else { const j = await res.json().catch(() => ({})); setError(j.error || 'Lỗi'); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Thêm bảo dưỡng</h3>
        <form onSubmit={submit} className="space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ngày</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cây số (km)</label>
              <input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Loại</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
              <option value="">--</option>
              <option value="BAO_DUONG">Bảo dưỡng</option>
              <option value="SUA_CHUA">Sửa chữa</option>
              <option value="DANG_KIEM">Đăng kiểm</option>
              <option value="BAO_HIEM">Bảo hiểm</option>
              <option value="KHAC">Khác</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Gara / đơn vị</label>
              <input type="text" value={form.workshop} onChange={(e) => setForm({ ...form, workshop: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Chi phí (đ)</label>
              <input type="number" value={form.costAmount} onChange={(e) => setForm({ ...form, costAmount: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg">Huỷ</button>
            <button type="submit" disabled={loading} className="px-3 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg inline-flex items-center gap-1">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 bg-white rounded-2xl border border-slate-200 p-4">{children}</div>
    </div>
  );
}

function KV({ label, value, span2 }: { label: string; value: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2 md:col-span-4' : ''}>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-slate-800 break-words">{value}</div>
    </div>
  );
}
