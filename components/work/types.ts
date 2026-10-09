/** Dữ liệu giao diện Quản lý công việc nhận từ `/api/work/**`. */
import type { WorkKindKey, WorkPriorityKey, WorkStatusKey } from '@/lib/work/constants';
import type { WorkAnalytics } from '@/lib/work/analytics';

export interface WorkHealthDTO {
  isClosed: boolean;
  isOverdue: boolean;
  daysToDue: number | null;
  isDueSoon: boolean;
  daysSinceActivity: number | null;
  isStale: boolean;
}

export interface AiStep {
  title: string;
  detail?: string;
  dueDate?: string;
  owner?: string;
  done: boolean;
}

export interface AiAssessment {
  level: 'on_track' | 'at_risk' | 'late';
  summary: string;
  nextAction: string;
}

export interface WorkItemDTO {
  id: string;
  source: 'QLCV' | 'MANUAL';
  externalId: string | null;
  externalUrl: string | null;
  kind: WorkKindKey;
  title: string;
  description: string | null;
  directedBy: string | null;
  directedAt: string | null;
  leadUnit: string | null;
  department: { id: string; name: string } | null;
  coordinatingUnits: string[];
  assignees: string[];
  watchers: string[];
  dueDate: string | null;
  status: WorkStatusKey;
  externalStatus: string | null;
  progressPercent: number | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  lastSeenAt: string | null;
  priority: WorkPriorityKey;
  tags: string[];
  characteristics: string | null;
  notes: string | null;
  aiPlan: AiStep[] | null;
  aiAssessment: AiAssessment | null;
  aiUpdatedAt: string | null;
  updateCount: number;
  createdAt: string;
  health: WorkHealthDTO;
}

export interface WorkUpdateDTO {
  id: string;
  source: 'QLCV' | 'MANUAL';
  occurredAt: string;
  author: string | null;
  content: string;
  progressPercent: number | null;
}

export interface WorkAttachmentDTO {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  originalSize: number | null;
  uploadedBy: string | null;
  createdAt: string;
  url: string;
  /** TASK | LOGTIME | RESULT | NOTES */
  kind?: string;
}

export interface WorkItemDetail extends WorkItemDTO {
  updates: WorkUpdateDTO[];
  /** File đính kèm cào từ office (chỉ có ở trang chi tiết). */
  attachments?: WorkAttachmentDTO[];
}

export interface WorkOverviewDTO {
  counts: { open: number; directives: number; overdue: number; stale: number; dueSoon: number; done: number; updatedThisWeek: number };
  overdue: WorkItemDTO[];
  stale: WorkItemDTO[];
  dueSoon: WorkItemDTO[];
  recentUpdates: Array<WorkUpdateDTO & { item: { id: string; title: string; unit: string | null } }>;
  byUnit: Array<{ unit: string; departmentId: string | null; open: number; overdue: number; stale: number }>;
  lastImport: {
    importedAt: string;
    scrapedAt: string | null;
    itemsSeen: number;
    itemsCreated: number;
    itemsChanged: number;
    updatesAdded: number;
    problemCount: number;
  } | null;
}

export type WorkAnalyticsDTO = WorkAnalytics & {
  filters: { year: number | null; departmentId: string | null; years: number[]; departments: Array<{ id: string; name: string; count: number }> };
  lists: { overdue: WorkItemDTO[]; dueSoon: WorkItemDTO[]; stale: WorkItemDTO[] };
  recentUpdates: Array<Omit<WorkUpdateDTO, 'source'> & { item: { id: string; title: string; unit: string | null } }>;
  lastImport: WorkOverviewDTO['lastImport'];
};

export interface WorkImportResult {
  itemsSeen: number;
  itemsCreated: number;
  itemsChanged: number;
  updatesAdded: number;
  problems: Array<{ index: number; externalId?: string; message: string }>;
}

export interface ReminderItemDTO {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  reason: 'overdue' | 'due_soon' | 'stale';
  health: WorkHealthDTO;
  departmentId: string | null;
  department: string;
  daysWithoutActivity: number;
  daysOverdue: number;
}

export interface ReminderDepartmentGroupDTO {
  departmentId: string | null;
  department: string;
  defaultEmail: string;
  emails: string[];
  items: ReminderItemDTO[];
}

export interface ReminderPreviewDTO {
  canSend: boolean;
  departments?: ReminderDepartmentGroupDTO[];
  recipients: Array<{
    secretaryId: string;
    name: string;
    email: string;
    department: string;
    subject: string;
    items: Array<{
      id: string;
      title: string;
      status: string;
      dueDate: string | null;
      reason: 'overdue' | 'due_soon' | 'stale';
      health: WorkHealthDTO;
      daysWithoutActivity?: number;
      daysOverdue?: number;
    }>;
  }>;
  departmentsWithoutEmail: Array<{ department: string; itemCount: number }>;
  unassignedCount: number;
}
