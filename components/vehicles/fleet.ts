/** Nhãn, màu và phép tính hạn giấy tờ dùng chung cho danh sách phương tiện. */
import { Ambulance, Bus, Car, HelpCircle, Package, Truck, type LucideIcon } from 'lucide-react';

export type VehicleCategory = 'AMBULANCE' | 'ADMIN_CAR' | 'BUS' | 'TRUCK' | 'PICKUP' | 'OTHER';
export type VehicleStatus = 'IN_USE' | 'RETIRED' | 'SOLD' | 'TRANSFERRED';

export interface VehicleRow {
  id: string;
  licensePlate: string;
  brand: string | null;
  model: string | null;
  category: VehicleCategory;
  color: string | null;
  manufactureYear: number | null;
  seatCount: string | null;
  status: VehicleStatus;
  manager: string | null;
  inspectionExpiry: string | null;
  insuranceExpiry: string | null;
  registrationNumber: string | null;
  expiryYear: string | null;
  fuelType: string | null;
  trips30: number;
  lastTripAt: string | null;
  odometer: number | null;
}

export const CATEGORY_META: Record<VehicleCategory, { label: string; Icon: LucideIcon; tone: string }> = {
  AMBULANCE: { label: 'Cứu thương', Icon: Ambulance, tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
  ADMIN_CAR: { label: 'Hành chính', Icon: Car, tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  BUS: { label: 'Xe khách', Icon: Bus, tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  TRUCK: { label: 'Xe tải', Icon: Truck, tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  PICKUP: { label: 'Bán tải', Icon: Package, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  OTHER: { label: 'Khác', Icon: HelpCircle, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

export const STATUS_META: Record<VehicleStatus, { label: string; tone: string }> = {
  IN_USE: { label: 'Đang sử dụng', tone: 'bg-emerald-50 text-emerald-700' },
  RETIRED: { label: 'Ngừng hoạt động', tone: 'bg-slate-100 text-slate-600' },
  SOLD: { label: 'Đã thanh lý', tone: 'bg-amber-50 text-amber-700' },
  TRANSFERRED: { label: 'Đã chuyển giao', tone: 'bg-violet-50 text-violet-700' },
};

/** Giấy tờ còn ≤ ngần này ngày là "sắp hết hạn". */
export const SOON_DAYS = 60;
/** Còn ≤ ngần này năm niên hạn thì nhắc. */
export const LIFETIME_WARN_YEARS = 2;

export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export type Urgency = 'expired' | 'soon' | 'ok' | 'none';
export const urgencyOf = (days: number | null): Urgency => (days === null ? 'none' : days < 0 ? 'expired' : days <= SOON_DAYS ? 'soon' : 'ok');

/** Số năm còn lại của niên hạn ("2037" → 11; "Không thời hạn" → null). */
export function lifetimeLeft(expiryYear: string | null, now = new Date()): number | null {
  const year = Number(expiryYear?.match(/\d{4}/)?.[0]);
  return Number.isFinite(year) && year > 0 ? year - now.getFullYear() : null;
}

/** Mức cần chú ý nhất của một xe — để xếp xe có việc lên đầu. */
export function vehicleUrgency(v: VehicleRow): number {
  const docs = [urgencyOf(daysUntil(v.inspectionExpiry)), urgencyOf(daysUntil(v.insuranceExpiry))];
  const life = lifetimeLeft(v.expiryYear);
  if (docs.includes('expired') || (life !== null && life < 0)) return 3;
  if (docs.includes('soon')) return 2;
  if (life !== null && life <= LIFETIME_WARN_YEARS) return 1;
  return 0;
}
