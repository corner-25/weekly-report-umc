import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/master-tasks/classify
 * Auto-detect progressType (RECURRING vs CUMULATIVE) for all master tasks
 * based on their historical progress data.
 *
 * Logic:
 * - Task with >= 3 weeks of data where 80%+ entries are 0 or 100 → RECURRING
 * - Task with progress that increases over time (e.g. 20→40→60) → CUMULATIVE
 * - Task with < 3 weeks of data → default RECURRING (most tasks are recurring)
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all master tasks with their weekly progress history
    const masterTasks = await prisma.masterTask.findMany({
      include: {
        weekProgress: {
          select: {
            progress: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    const classifications: {
      id: string;
      name: string;
      progressType: 'RECURRING' | 'CUMULATIVE';
      reason: string;
      progressHistory: (number | null)[];
    }[] = [];

    for (const task of masterTasks) {
      const progressValues = task.weekProgress.map(wp => wp.progress ?? 0);
      const { type, reason } = classifyTask(progressValues);

      classifications.push({
        id: task.id,
        name: task.name,
        progressType: type,
        reason,
        progressHistory: progressValues,
      });
    }

    // Batch update all tasks
    const updatePromises = classifications.map(c =>
      prisma.masterTask.update({
        where: { id: c.id },
        data: { progressType: c.progressType },
      })
    );

    await prisma.$transaction(updatePromises);

    const recurringCount = classifications.filter(c => c.progressType === 'RECURRING').length;
    const cumulativeCount = classifications.filter(c => c.progressType === 'CUMULATIVE').length;

    return NextResponse.json({
      message: `Đã phân loại ${classifications.length} nhiệm vụ: ${recurringCount} thường quy, ${cumulativeCount} tích lũy`,
      total: classifications.length,
      recurring: recurringCount,
      cumulative: cumulativeCount,
      details: classifications,
    });
  } catch (error) {
    console.error('Error classifying tasks:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

/**
 * GET /api/master-tasks/classify
 * Preview classification without applying changes
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const masterTasks = await prisma.masterTask.findMany({
      include: {
        department: { select: { name: true } },
        weekProgress: {
          select: { progress: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    });

    const preview = masterTasks.map(task => {
      const progressValues = task.weekProgress.map(wp => wp.progress ?? 0);
      const { type, reason } = classifyTask(progressValues);

      return {
        id: task.id,
        name: task.name,
        department: task.department.name,
        currentType: task.progressType,
        suggestedType: type,
        reason,
        weekCount: progressValues.length,
        progressHistory: progressValues,
      };
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error('Error previewing classification:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

function classifyTask(progressValues: number[]): { type: 'RECURRING' | 'CUMULATIVE'; reason: string } {
  // Not enough data — default to RECURRING (most hospital tasks are recurring)
  if (progressValues.length < 3) {
    return { type: 'RECURRING', reason: 'Chưa đủ dữ liệu (< 3 tuần), mặc định thường quy' };
  }

  // Count how many entries are 0 or 100
  const zeroOr100Count = progressValues.filter(v => v === 0 || v === 100).length;
  const zeroOr100Ratio = zeroOr100Count / progressValues.length;

  // If 80%+ entries are 0 or 100, it's recurring
  if (zeroOr100Ratio >= 0.8) {
    return { type: 'RECURRING', reason: `${Math.round(zeroOr100Ratio * 100)}% entries là 0% hoặc 100% → thường quy` };
  }

  // Check for increasing pattern (cumulative)
  const nonZeroValues = progressValues.filter(v => v > 0);
  if (nonZeroValues.length >= 2) {
    let increasing = 0;
    let decreasing = 0;
    for (let i = 1; i < nonZeroValues.length; i++) {
      if (nonZeroValues[i] > nonZeroValues[i - 1]) increasing++;
      if (nonZeroValues[i] < nonZeroValues[i - 1]) decreasing++;
    }

    if (increasing > decreasing && increasing >= 2) {
      return { type: 'CUMULATIVE', reason: `Tiến độ tăng dần (${nonZeroValues.join('→')}) → tích lũy` };
    }
  }

  // Check for varied non-zero values (likely cumulative project tracking)
  const uniqueNonZero = new Set(nonZeroValues);
  if (uniqueNonZero.size >= 3 && nonZeroValues.length >= 3) {
    return { type: 'CUMULATIVE', reason: `Nhiều mức tiến độ khác nhau (${Array.from(uniqueNonZero).join(', ')}) → tích lũy` };
  }

  // Default to recurring
  return { type: 'RECURRING', reason: 'Pattern không rõ ràng, mặc định thường quy' };
}
