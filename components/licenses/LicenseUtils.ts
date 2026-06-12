export type LicenseStatus = 'EXPIRED' | 'EXPIRING_SOON' | 'ACTIVE' | 'NO_EXPIRY';

export const EXPIRING_SOON_DAYS = 90;

export function getLicenseStatus(expiryDate: string | null): LicenseStatus {
  if (!expiryDate) return 'NO_EXPIRY';
  const today = new Date();
  const expiry = new Date(expiryDate);
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + EXPIRING_SOON_DAYS);

  if (expiry < today) return 'EXPIRED';
  if (expiry < threshold) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Categories shown in the UI dropdown. VEHICLE / ADMIN_VEHICLE rows still exist
// in the DB and are surfaced from the Phương tiện vận chuyển page; they're
// removed from the Giấy phép selector so the two pages stay distinct.
export const CATEGORY_LABELS: Record<string, string> = {
  HOSPITAL: 'Bệnh viện',
  DEPARTMENT: 'Khoa/Phòng',
  EQUIPMENT: 'Thiết bị y tế',
  OTHER: 'Khác',
};

// Full label map including vehicle categories, used when rendering legacy rows
// that still carry those categories.
export const CATEGORY_LABELS_FULL: Record<string, string> = {
  ...CATEGORY_LABELS,
  VEHICLE: 'Xe cứu thương',
  ADMIN_VEHICLE: 'Xe hành chính',
};

export const CATEGORY_COLORS: Record<string, string> = {
  HOSPITAL: 'bg-purple-100 text-purple-700',
  DEPARTMENT: 'bg-blue-100 text-blue-700',
  VEHICLE: 'bg-orange-100 text-orange-700',
  ADMIN_VEHICLE: 'bg-amber-100 text-amber-700',
  EQUIPMENT: 'bg-cyan-100 text-cyan-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

// Categories excluded from the Giấy phép list / stats by default.
export const VEHICLE_CATEGORIES: ReadonlyArray<string> = ['VEHICLE', 'ADMIN_VEHICLE'];
