import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const masterTaskSchema = z.object({
  departmentId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  estimatedDuration: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// GET all master tasks (có thể filter theo department)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const includeProgress = searchParams.get('includeProgress') === 'true';

    const where: any = {};
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const masterTasks = await prisma.masterTask.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        weekProgress: includeProgress
          ? {
              select: {
                id: true,
                progress: true,
                result: true,
                completedAt: true,
                week: {
                  select: {
                    weekNumber: true,
                    year: true,
                    startDate: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            }
          : {
              select: {
                id: true,
                progress: true,
                completedAt: true,
                weekId: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1, // Lấy progress mới nhất
            },
        _count: {
          select: {
            weekProgress: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform để thêm latest progress
    const transformed = masterTasks.map((task) => {
      const latestWeekProgress = includeProgress && task.weekProgress.length > 0
        ? task.weekProgress[task.weekProgress.length - 1]
        : task.weekProgress[0];

      const baseData = {
        ...task,
        latestProgress: latestWeekProgress?.progress ?? 0, // Use 0 if null or undefined
        isCompleted: latestWeekProgress?.completedAt !== null && latestWeekProgress !== undefined,
        weekCount: task._count.weekProgress,
      };

      if (includeProgress && task.weekProgress.length > 0) {
        // Map and sort by year then weekNumber
        const weeklyProgress = task.weekProgress
          .map((wp: any) => ({
            weekNumber: wp.week.weekNumber,
            year: wp.week.year,
            progress: wp.progress ?? 0, // Handle null progress
            result: wp.result,
            startDate: wp.week.startDate,
          }))
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.weekNumber - b.weekNumber;
          });

        return {
          ...baseData,
          weeklyProgress,
          firstWeek: weeklyProgress[0] ? {
            weekNumber: weeklyProgress[0].weekNumber,
            year: weeklyProgress[0].year,
          } : null,
          lastWeek: weeklyProgress[weeklyProgress.length - 1] ? {
            weekNumber: weeklyProgress[weeklyProgress.length - 1].weekNumber,
            year: weeklyProgress[weeklyProgress.length - 1].year,
          } : null,
        };
      }

      return baseData;
    });

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching master tasks:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST - Create new master task
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = masterTaskSchema.parse(body);

    const masterTask = await prisma.masterTask.create({
      data: {
        departmentId: data.departmentId,
        name: data.name,
        description: data.description,
        estimatedDuration: data.estimatedDuration,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json(masterTask, { status: 201 });
  } catch (error) {
    console.error('Error creating master task:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
