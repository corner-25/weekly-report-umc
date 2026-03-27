export const EXPIRING_SOON_DAYS = 90;

export const CATEGORY_LABELS: Record<string, string> = {
  DOMESTIC: 'Trong nước',
  INTERNATIONAL: 'Quốc tế',
  ACADEMIC: 'Đào tạo - NCKH',
  CLINICAL: 'Lâm sàng',
  TECHNOLOGY: 'Công nghệ',
  OTHER: 'Khác',
};

export const CATEGORY_COLORS: Record<string, string> = {
  DOMESTIC: 'bg-blue-100 text-blue-700',
  INTERNATIONAL: 'bg-purple-100 text-purple-700',
  ACADEMIC: 'bg-indigo-100 text-indigo-700',
  CLINICAL: 'bg-emerald-100 text-emerald-700',
  TECHNOLOGY: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Hiệu lực',
  EXPIRING: 'Sắp hết hạn',
  EXPIRED: 'Hết hạn',
  TERMINATED: 'Đã chấm dứt',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-700',
  EXPIRING: 'bg-orange-100 text-orange-700',
  EXPIRED: 'bg-red-100 text-red-700',
  TERMINATED: 'bg-gray-200 text-gray-500',
};

export const CLAUSE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Chưa triển khai',
  IN_PROGRESS: 'Đang triển khai',
  COMPLETED: 'Hoàn thành',
  ON_HOLD: 'Tạm dừng',
  CANCELLED: 'Đã hủy',
};

export const CLAUSE_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export const CLAUSE_TYPE_LABELS: Record<string, string> = {
  TRAINING: 'Đào tạo',
  RESEARCH: 'Nghiên cứu khoa học',
  CLINICAL: 'Chuyên môn / Lâm sàng',
  TECHNOLOGY_TRANSFER: 'Chuyển giao kỹ thuật',
  EXPERT_EXCHANGE: 'Trao đổi chuyên gia',
  FACILITY: 'Cơ sở vật chất / Phòng khám',
  EQUIPMENT: 'Thiết bị / Vật tư',
  FINANCE: 'Tài chính / Tài trợ',
  HR: 'Nhân sự / Tuyển dụng',
  EVENT: 'Hội thảo / Sự kiện',
  PUBLICATION: 'Xuất bản / Ấn phẩm',
  OTHER: 'Khác',
};

export const CLAUSE_TYPE_COLORS: Record<string, string> = {
  TRAINING: 'bg-blue-100 text-blue-700',
  RESEARCH: 'bg-purple-100 text-purple-700',
  CLINICAL: 'bg-emerald-100 text-emerald-700',
  TECHNOLOGY_TRANSFER: 'bg-orange-100 text-orange-700',
  EXPERT_EXCHANGE: 'bg-indigo-100 text-indigo-700',
  FACILITY: 'bg-cyan-100 text-cyan-700',
  EQUIPMENT: 'bg-amber-100 text-amber-700',
  FINANCE: 'bg-pink-100 text-pink-700',
  HR: 'bg-teal-100 text-teal-700',
  EVENT: 'bg-rose-100 text-rose-700',
  PUBLICATION: 'bg-violet-100 text-violet-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

export const RESPONSIBLE_PARTY_LABELS: Record<string, string> = {
  UMC: 'Phía UMC',
  PARTNER: 'Phía đối tác',
  BOTH: 'Cả hai bên',
};

export const RESPONSIBLE_PARTY_COLORS: Record<string, string> = {
  UMC: 'bg-cyan-100 text-cyan-700',
  PARTNER: 'bg-purple-100 text-purple-700',
  BOTH: 'bg-slate-100 text-slate-700',
};

export const QUALITY_OPTIONS = [
  { value: '', label: 'Chưa đánh giá' },
  { value: 'Tốt', label: 'Tốt' },
  { value: 'Đạt', label: 'Đạt' },
  { value: 'Chưa đạt', label: 'Chưa đạt' },
];

export function getMOUDisplayStatus(mou: { status: string; expiryDate: string | null }): string {
  if (mou.status === 'TERMINATED') return 'TERMINATED';
  if (mou.status === 'DRAFT') return 'DRAFT';

  if (mou.expiryDate) {
    const today = new Date();
    const expiry = new Date(mou.expiryDate);
    const soon = new Date();
    soon.setDate(soon.getDate() + EXPIRING_SOON_DAYS);

    if (expiry <= today) return 'EXPIRED';
    if (expiry <= soon) return 'EXPIRING';
  }

  return 'ACTIVE';
}

export function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('vi-VN');
}

export function getOverallProgress(clauses: { progress: number }[]): number {
  if (clauses.length === 0) return 0;
  const total = clauses.reduce((sum, c) => sum + c.progress, 0);
  return Math.round(total / clauses.length);
}
