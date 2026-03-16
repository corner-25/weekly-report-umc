import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const [
      totalMasterTasks,
      tasksInProgress,
      tasksCompleted,
      recentWeeks,
      upcomingEvents,
      todayEvents,
      totalMeetingRooms,
      secretaryCounts,
      birthdaySecretaries,
      recentTransfers,
    ] = await Promise.all([
      // Total master tasks
      prisma.masterTask.count(),

      // Tasks in progress (has weekProgress but not completed)
      prisma.masterTask.count({
        where: {
          weekProgress: { some: {} },
          NOT: { weekProgress: { some: { completedAt: { not: null } } } },
        },
      }),

      // Tasks completed
      prisma.masterTask.count({
        where: { weekProgress: { some: { completedAt: { not: null } } } },
      }),

      // Recent weeks (last 3)
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

      // Upcoming events (next 5)
      prisma.hospitalEvent.findMany({
        where: { date: { gte: startOfToday } },
        take: 5,
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

      // Today's events
      prisma.hospitalEvent.findMany({
        where: { date: { gte: startOfToday, lte: endOfToday } },
        orderBy: { time: 'asc' },
        select: {
          id: true,
          name: true,
          date: true,
          time: true,
          status: true,
          meetingRoom: { select: { name: true } },
        },
      }),

      // Total meeting rooms
      prisma.meetingRoom.count({ where: { deletedAt: null } }),

      // Secretary counts
      prisma.secretary.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),

      // Birthdays this week
      prisma.secretary.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          dateOfBirth: { not: null },
        },
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
        },
      }),

      // Recent transfers (last 3)
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
    ]);

    // Filter birthdays in this week
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

    return NextResponse.json({
      totalMasterTasks,
      tasksInProgress,
      tasksCompleted,
      totalWeeks: await prisma.week.count(),
      recentWeeks: recentWeeks.map((w) => ({ ...w, taskCount: w._count.taskProgress })),
      upcomingEvents,
      todayEvents,
      totalMeetingRooms,
      totalSecretaries,
      activeSecretaries,
      birthdaySecretaries: weekBirthdays,
      recentTransfers,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
