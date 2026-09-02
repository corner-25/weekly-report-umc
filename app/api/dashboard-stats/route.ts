import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { CACHE_TAGS } from '@/lib/cache';
import { getMasterTaskStatusCounts } from '@/lib/master-task-status';
import { birthdayInYear, NON_SECRETARY_TYPE, sameUtcDate, todayInAppTimeZone } from '@/lib/birthday';

// Server-side cache: revalidate every 2 minutes
const getCachedDashboardStats = unstable_cache(
  async () => {
    const now = todayInAppTimeZone();
    const startOfToday = new Date(now);
    const endOfToday = new Date(now);
    endOfToday.setUTCHours(23, 59, 59, 999);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setUTCDate(startOfToday.getUTCDate() - startOfToday.getUTCDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);

    const moUExpirySoon = new Date();
    moUExpirySoon.setDate(moUExpirySoon.getDate() + 90);

    const [
      masterTaskStatusCounts,
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
      getMasterTaskStatusCounts(),

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
        where: {
          deletedAt: null,
          secretaryType: { is: { name: { not: NON_SECRETARY_TYPE } } },
        },
        _count: true,
      }),

      prisma.secretary.groupBy({
        by: ['secretaryTypeId'],
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          secretaryType: { is: { name: { not: NON_SECRETARY_TYPE } } },
        },
        _count: true,
      }),

      prisma.secretaryType.findMany({
        where: { isActive: true },
        select: { id: true, name: true, color: true },
      }),

      prisma.secretary.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          dateOfBirth: { not: null },
          secretaryType: { is: { name: { not: NON_SECRETARY_TYPE } } },
        },
        select: { id: true, fullName: true, dateOfBirth: true },
      }),

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

    const totalMasterTasks = masterTaskStatusCounts.total;
    const tasksInProgress = masterTaskStatusCounts.inProgress;
    const tasksCompleted = masterTaskStatusCounts.completed;

    const todayEvents = todayAndUpcomingEvents
      .filter((e) => e.date >= startOfToday && e.date <= endOfToday)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    const upcomingEvents = todayAndUpcomingEvents.slice(0, 5);

    const weekBirthdays = birthdaySecretaries
      .filter((s) => {
        if (!s.dateOfBirth) return false;
        const dob = new Date(s.dateOfBirth);
        const bday = birthdayInYear(dob, now.getUTCFullYear());
        return bday >= startOfWeek && bday <= endOfWeek;
      })
      .map((s) => {
        const dob = new Date(s.dateOfBirth!);
        const bday = birthdayInYear(dob, now.getUTCFullYear());
        return {
          id: s.id,
          fullName: s.fullName,
          birthdayDay: dob.getUTCDate(),
          birthdayMonth: dob.getUTCMonth() + 1,
          age: now.getUTCFullYear() - dob.getUTCFullYear(),
          isToday: sameUtcDate(bday, startOfToday),
        };
      })
      .sort((a, b) => {
        const aDate = Date.UTC(now.getUTCFullYear(), a.birthdayMonth - 1, a.birthdayDay);
        const bDate = Date.UTC(now.getUTCFullYear(), b.birthdayMonth - 1, b.birthdayDay);
        return aDate - bDate || a.fullName.localeCompare(b.fullName, 'vi');
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
      birthdayPreview: weekBirthdays.slice(0, 4),
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
