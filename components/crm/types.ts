/**
 * Kiểu dữ liệu giao diện CRM nhận từ API `/api/crm/**` (DTO đầu ra).
 * Kiểu đầu vào (form → API) lấy từ `@/lib/crm/schemas`.
 */
import type { ReconcileRow } from '@/lib/crm/reconcile';
import type {
  DATE_KIND_LABELS,
  INTERACTION_TYPE_LABELS,
  INTERACTION_STATUS_LABELS,
  ORGANIZATION_TYPE_LABELS,
  RELATION_KIND_LABELS,
  TIER_LABELS,
  CONTACT_STATUS_LABELS,
} from '@/lib/crm/constants';

export type Tier = keyof typeof TIER_LABELS;
export type OrganizationType = keyof typeof ORGANIZATION_TYPE_LABELS;
export type RelationKind = keyof typeof RELATION_KIND_LABELS;
export type DateKind = keyof typeof DATE_KIND_LABELS;
export type InteractionType = keyof typeof INTERACTION_TYPE_LABELS;
export type InteractionStatus = keyof typeof INTERACTION_STATUS_LABELS;
export type ContactStatus = keyof typeof CONTACT_STATUS_LABELS;

export interface InteractionDTO {
  id: string;
  type: InteractionType;
  status: InteractionStatus;
  createdById: string | null;
  occurredAt: string;
  title: string | null;
  content: string;
  destination: string | null;
  patientName: string | null;
  services: string[];
  guestCount: number | null;
  purpose: string | null;
  staffName: string;
  companions: string[];
  note: string | null;
  contact: { id: string; fullName: string; academicTitle: string | null } | null;
  organization: { id: string; name: string } | null;
  participants: Array<{ id: string; fullName: string }>;
}

export interface ImportantDateDTO {
  id: string;
  kind: DateKind;
  label: string | null;
  day: number;
  month: number;
  year: number | null;
  isLunar: boolean;
  repeatsYearly: boolean;
  remindDaysBefore: number | null;
  note: string | null;
}

export interface UpcomingDTO {
  key: string;
  kind: DateKind;
  label: string;
  date: string;
  daysUntil: number;
  years: number | null;
  isLunar: boolean;
}

export interface OverviewUpcoming extends UpcomingDTO {
  target: {
    type: 'contact' | 'organization';
    id: string;
    name: string;
    tier: Tier;
    subtitle: string | null;
  };
}

export interface DormantItem {
  type: 'contact' | 'organization';
  id: string;
  name: string;
  tier: Tier;
  lastInteractionAt: string | null;
  daysSince: number | null;
}

export interface OverviewDTO {
  upcoming: OverviewUpcoming[];
  recentInteractions: InteractionDTO[];
  /** Lịch hẹn dẫn khách/đoàn sắp tới. */
  planned: InteractionDTO[];
  /** Lịch hẹn đã qua ngày mà chưa cập nhật kết quả. */
  overduePlanned: InteractionDTO[];
  dormant: DormantItem[];
  /** Đối chiếu với Excel báo cáo tuần, tháng gần nhất trước. */
  reconcile: ReconcileRow[];
  counts: {
    contacts: number;
    organizations: number;
    interactionsThisMonth: number;
    vipEscortsThisMonth: number;
    delegationsThisMonth: number;
  };
}

export interface SearchDTO {
  contacts: Array<{ id: string; fullName: string; academicTitle: string | null; subtitle: string | null }>;
  organizations: Array<{ id: string; name: string }>;
}

export interface ContactListItem {
  id: string;
  fullName: string;
  academicTitle: string | null;
  salutation: string | null;
  tier: Tier;
  tags: string[];
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  status: ContactStatus;
  currentPosition: { title: string; organization: { id: string; name: string } | null } | null;
  lastInteractionAt: string | null;
}

export interface OrganizationListItem {
  id: string;
  name: string;
  type: OrganizationType;
  tier: Tier;
  ownerName: string | null;
  tags: string[];
  contactCount: number;
  lastInteractionAt: string | null;
  nextAnniversary: { date: string; label: string } | null;
}

export interface Preferences {
  flowers?: string | null;
  avoid?: string | null;
  food?: string | null;
  hobbies?: string | null;
}

export interface PositionDTO {
  id: string;
  title: string;
  department: string | null;
  fromDate: string | null;
  toDate: string | null;
  isCurrent: boolean;
  organization: { id: string; name: string } | null;
}

export interface RelationDTO {
  id: string;
  kind: RelationKind;
  name: string | null;
  phone: string | null;
  note: string | null;
  toContact: { id: string; fullName: string } | null;
}

export interface ContactDetail {
  id: string;
  fullName: string;
  academicTitle: string | null;
  salutation: string | null;
  gender: 'Nam' | 'Nữ' | null;
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  birthIsLunar: boolean;
  phone: string | null;
  email: string | null;
  giftAddress: string | null;
  tier: Tier;
  tags: string[];
  ownerName: string | null;
  preferences: Preferences | null;
  /** Chỉ có khi người xem được phép — nếu không thì API bỏ hẳn trường. */
  sensitiveNote?: string | null;
  status: ContactStatus;
  source: string | null;
  note: string | null;
  canSeeSensitive: boolean;
  positions: PositionDTO[];
  relations: RelationDTO[];
  importantDates: ImportantDateDTO[];
  interactions: InteractionDTO[];
  upcoming: UpcomingDTO[];
}

export interface OrganizationDetail {
  id: string;
  name: string;
  type: OrganizationType;
  tier: Tier;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  ownerName: string | null;
  tags: string[];
  note: string | null;
  contacts: Array<{ id: string; fullName: string; academicTitle: string | null; title: string | null; isCurrent: boolean }>;
  importantDates: ImportantDateDTO[];
  interactions: InteractionDTO[];
  upcoming: UpcomingDTO[];
}
