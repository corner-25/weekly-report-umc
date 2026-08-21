/**
 * Điều phối pipeline trích xuất báo cáo tuần bệnh viện.
 *
 * Nối các giai đoạn lại và ghi kết quả vào database, có ghi vết mọi lần gọi AI
 * vào `AiExtractionRun` để so sánh chất lượng khi đổi model hoặc sửa prompt.
 *
 * Mặc định kết quả AI ở trạng thái chờ người duyệt (`isActive = false`). Người
 * vận hành có thể bật `autoApprove` để kích hoạt ngay — xem RunGroupingOptions
 * để biết rủi ro.
 *
 * Xem docs/HOSPITAL-REPORT-PIPELINE.md.
 */
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PROMPT_VERSION, type TaskContext } from './prompts';
import {
  groupDepartmentTasks,
  LOW_CONFIDENCE_THRESHOLD,
  type GroupingResult,
  type ProgressMeaning,
  type TaskType,
} from './task-grouping';

/** Model mặc định — đã đo là cho kết quả tốt nhất ở tác vụ phân loại. */
const DEFAULT_MODEL = 'glm-4.5';

export interface RunGroupingOptions {
  model?: string;
  db?: PrismaClient;
  /**
   * Kích hoạt MasterTask ngay thay vì chờ người duyệt.
   *
   * Mặc định false — AI có thể sai theo cách không tự phát hiện được. Đo trên
   * dữ liệu thật: prompt v1 gán sai 43/50 nhiệm vụ CUMULATIVE; lỗi đó bắt được
   * nhờ kiểm chứng bằng code, nhưng việc gom nghiệp vụ thì không có cách kiểm
   * tự động nào. Bật true khi người vận hành chấp nhận rủi ro đó.
   */
  autoApprove?: boolean;
}

export interface GroupingSummary {
  departmentId: string;
  departmentName: string;
  areasCreated: number;
  tasksAssigned: number;
  unassigned: string[];
  lowConfidence: number;
  totalTokens: number;
  durationMs: number;
}

/**
 * Gom nhiệm vụ của một phòng thành nghiệp vụ rồi lưu thành MasterTask.
 *
 * Mọi biến thể tên gốc được ghi vào `aliases` để lần sau khớp ngay không cần
 * gọi AI — đây là cơ chế học dần, chi phí giảm theo thời gian.
 */
export async function runGroupingForDepartment(
  departmentId: string,
  departmentName: string,
  tasks: readonly TaskContext[],
  options: RunGroupingOptions = {},
): Promise<GroupingSummary> {
  const db = options.db ?? prisma;
  const model = options.model ?? DEFAULT_MODEL;

  const run = await db.aiExtractionRun.create({
    data: {
      stage: 'GROUP_TASKS',
      departmentId,
      model,
      promptVersion: PROMPT_VERSION,
      itemsInput: tasks.length,
    },
  });

  try {
    const result = await groupDepartmentTasks(departmentName, tasks);
    const summary = await persistGrouping(
      db, departmentId, departmentName, tasks, result, options.autoApprove ?? false,
    );

    await db.aiExtractionRun.update({
      where: { id: run.id },
      data: {
        itemsOutput: summary.tasksAssigned,
        flagged: summary.lowConfidence + summary.unassigned.length,
        tokensUsed: result.totalTokens,
        durationMs: result.durationMs,
      },
    });

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    await db.aiExtractionRun.update({
      where: { id: run.id },
      data: { errorMessage: message, durationMs: 0 },
    });
    throw error;
  }
}

async function persistGrouping(
  db: PrismaClient,
  departmentId: string,
  departmentName: string,
  tasks: readonly TaskContext[],
  result: GroupingResult,
  autoApprove: boolean,
): Promise<GroupingSummary> {
  const classificationByName = new Map(result.classifications.map((c) => [c.taskName, c]));
  const taskByName = new Map(tasks.map((t) => [t.name, t]));

  // Gom biến thể tên theo nghiệp vụ, đồng thời tổng hợp phân loại.
  interface AreaDraft {
    name: string;
    description: string;
    aliases: string[];
    types: TaskType[];
    meanings: ProgressMeaning[];
    firstWeek: number | null;
    lastWeek: number | null;
  }

  const drafts = new Map<number, AreaDraft>();
  let lowConfidence = 0;

  for (const assignment of result.assignments) {
    if (assignment.confidence < LOW_CONFIDENCE_THRESHOLD) lowConfidence += 1;

    const area = result.areas[assignment.areaIndex];
    if (!area) continue;

    const draft = drafts.get(assignment.areaIndex) ?? {
      name: area.ten,
      description: area.mo_ta ?? '',
      aliases: [],
      types: [],
      meanings: [],
      firstWeek: null,
      lastWeek: null,
    };

    draft.aliases.push(assignment.taskName);

    const classification = classificationByName.get(assignment.taskName);
    if (classification) {
      draft.types.push(classification.taskType);
      draft.meanings.push(classification.progressMeaning);
    }

    // Nhiệm vụ nguồn không mang số tuần cụ thể, chỉ có số lần xuất hiện —
    // dùng weekCount làm mốc thô để biết nghiệp vụ trải dài bao lâu.
    const source = taskByName.get(assignment.taskName);
    if (source) {
      draft.lastWeek = Math.max(draft.lastWeek ?? 0, source.weekCount);
    }

    drafts.set(assignment.areaIndex, draft);
  }

  let areasCreated = 0;
  for (const draft of drafts.values()) {
    await db.masterTask.create({
      data: {
        departmentId,
        name: draft.name,
        description: draft.description,
        // Loại phổ biến nhất trong các biến thể đại diện cho cả nghiệp vụ.
        progressType: majority(draft.types, 'RECURRING'),
        progressMeaning: majority(draft.meanings, 'WEEKLY_DONE'),
        aliases: [...new Set(draft.aliases)],
        sourceType: autoApprove ? 'AI_GROUPED' : 'AI_SUGGESTED',
        // Khi không tự duyệt, MasterTask nằm im tới khi người dùng xác nhận.
        isActive: autoApprove,
        lastSeenWeek: draft.lastWeek,
      },
    });
    areasCreated += 1;
  }

  return {
    departmentId,
    departmentName,
    areasCreated,
    tasksAssigned: result.assignments.length,
    unassigned: result.unassigned,
    lowConfidence,
    totalTokens: result.totalTokens,
    durationMs: result.durationMs,
  };
}

/** Giá trị xuất hiện nhiều nhất; dùng mặc định khi mảng rỗng. */
function majority<T extends string>(values: readonly T[], fallback: T): T {
  if (values.length === 0) return fallback;

  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  let best = fallback;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
