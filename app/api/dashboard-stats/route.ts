import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { CACHE_TAGS } from '@/lib/cache';

// Server-side cache: revalidate every 2 minutes
const getCachedDashboardStats = unstable_cache(
  async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    // Master task status: 1 raw query instead of 3 separate counts.
    // Buckets: total, withProgress (any week_progress row), completed (any completedAt).
    type MasterTaskStatsRow = {
      total: bigint;
      withProgress: bigint;
      completed: bigint;
    };

    const moUExpirySoon = new Date();
    moUExpirySoon.setDate(moUExpirySoon.getDate() + 90);

    const [
      masterTaskStatsRows,
      totalWeeks,
      recentWeeks,
      todayAndUpcomingEvents,
      totalMeetingRooms,
      secretaryCounts,
      secretaryTypeCounts,
      secretaryTypes,
      birthdaySecretaries,
      recentTransfers,
      expiringMOUs,
    ] = await Promise.all([
      prisma.$queryRaw<MasterTaskStatsRow[]>`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM week_task_progress wtp WHERE wtp."masterTaskId" = mt.id
            )
          )::bigint AS "withProgress",
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM week_task_progress wtp
              WHERE wtp."masterTaskId" = mt.id AND wtp."completedAt" IS NOT NULL
            )
          )::bigint AS completed
        FROM master_tasks mt
      `,

      prisma.week.count(),

      prisma.week.findMany({
        take: 3,
        orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
        select: {
          id: true,
          weekNumber: true,
          year: true,
          startDate: true,
          endDate: true,
          status: true,
          _count: { select: { taskProgress: true } },
        },
      }),

      // One query covers both upcoming (>= today) and today range. Split client-side.
      prisma.hospitalEvent.findMany({
        where: { deletedAt: null, date: { gte: startOfToday } },
        take: 15,
        orderBy: { date: 'asc' },
        select: {
          id: true,
          name: true,
          date: true,
          time: true,
          status: true,
          meetingRoom: { select: { name: true } },
        },
      }),

      prisma.meetingRoom.count({ where: { deletedAt: null } }),

      prisma.secretary.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),

      prisma.secretary.groupBy({
        by: ['secretaryTypeId'],
        where: { deletedAt: null, status: 'ACTIVE' },
        _count: true,
      }),

      prisma.secretaryType.findMany({
        where: { isActive: true },
        select: { id: true, name: true, color: true },
      }),

      prisma.$queryRaw<{ id: string; fullName: string; dateOfBirth: Date }[]>`
        SELECT id, "fullName", "dateOfBirth"
        FROM secretaries
        WHERE "deletedAt" IS NULL
          AND status = 'ACTIVE'
          AND "dateOfBirth" IS NOT NULL
          AND EXTRACT(MONTH FROM "dateOfBirth") = ANY(ARRAY[${startOfWeek.getMonth() + 1}::int, ${endOfWeek.getMonth() + 1}::int])
        LIMIT 20
      `,

      prisma.secretaryTransferLog.findMany({
        take: 3,
        orderBy: { transferDate: 'desc' },
        select: {
          id: true,
          transferDate: true,
          secretary: { select: { fullName: true } },
          fromDepartment: { select: { name: true } },
          toDepartment: { select: { name: true } },
        },
      }),

      prisma.mOU.findMany({
        where: {
          deletedAt: null,
          status: { in: ['ACTIVE', 'EXPIRED'] },
          expiryDate: { not: null, lte: moUExpirySoon },
        },
        take: 5,
        orderBy: { expiryDate: 'asc' },
        select: {
          id: true,
          title: true,
          mouNumber: true,
          partnerName: true,
          expiryDate: true,
          status: true,
        },
      }),
    ]);

    const masterTaskStats = masterTaskStatsRows[0] ?? {
      total: BigInt(0),
      withProgress: BigInt(0),
      completed: BigInt(0),
    };
    const totalMasterTasks = Number(masterTaskStats.total);
    const tasksCompleted = Number(masterTaskStats.completed);
    const tasksInProgress = Number(masterTaskStats.withProgress) - tasksCompleted;

    const todayEvents = todayAndUpcomingEvents
      .filter((e) => e.date >= startOfToday && e.date <= endOfToday)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    const upcomingEvents = todayAndUpcomingEvents.slice(0, 5);

    const weekBirthdays = birthdaySecretaries
      .filter((s) => {
        if (!s.dateOfBirth) return false;
        const dob = new Date(s.dateOfBirth);
        const bday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
        return bday >= startOfWeek && bday <= endOfWeek;
      })
      .slice(0, 5)
      .map((s) => {
        const dob = new Date(s.dateOfBirth!);
        const bday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
        return {
          id: s.id,
          fullName: s.fullName,
          birthdayDay: dob.getDate(),
          birthdayMonth: dob.getMonth() + 1,
          age: now.getFullYear() - dob.getFullYear(),
          isToday: bday.toDateString() === startOfToday.toDateString(),
        };
      });

    const totalSecretaries = secretaryCounts.reduce((sum, g) => sum + g._count, 0);
    const activeSecretaries = secretaryCounts.find((g) => g.status === 'ACTIVE')?._count ?? 0;

    const typeMap = new Map(secretaryTypes.map((t) => [t.id, t]));
    const secretariesByType = secretaryTypeCounts.map((g) => {
      const t = g.secretaryTypeId ? typeMap.get(g.secretaryTypeId) : null;
      return {
        typeId: g.secretaryTypeId,
        name: t?.name ?? 'Chưa phân loại',
        color: t?.color ?? '#94a3b8',
        count: g._count,
      };
    }).sort((a, b) => b.count - a.count);

    return {
      totalMasterTasks,
      tasksInProgress,
      tasksCompleted,
      totalWeeks,
      recentWeeks: recentWeeks.map((w) => ({ ...w, taskCount: w._count.taskProgress })),
      upcomingEvents,
      todayEvents,
      totalMeetingRooms,
      totalSecretaries,
      activeSecretaries,
      secretariesByType,
      birthdaySecretaries: weekBirthdays,
      recentTransfers,
      expiringMOUs,
    };
  },
  [CACHE_TAGS.dashboardStats],
  { revalidate: 120, tags: [CACHE_TAGS.dashboardStats] } // Cache 2 minutes
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getCachedDashboardStats();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
