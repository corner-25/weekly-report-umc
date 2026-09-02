import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { nextBirthday, NON_SECRETARY_TYPE, sameUtcDate, todayInAppTimeZone } from '@/lib/birthday';

// GET - Lấy danh sách sinh nhật
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month'; // today, week, month

    const today = todayInAppTimeZone();
    const currentMonth = today.getUTCMonth() + 1;
    const currentDay = today.getUTCDate();

    const secretaries = await prisma.secretary.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        dateOfBirth: { not: null },
        secretaryType: { is: { name: { not: NON_SECRETARY_TYPE } } },
      },
      include: {
        secretaryType: true,
        currentDepartment: true,
      },
      orderBy: { fullName: 'asc' }
    });

    let filteredSecretaries = secretaries.filter(s => s.dateOfBirth !== null);

    if (period === 'today') {
      filteredSecretaries = filteredSecretaries.filter(s => {
        const dob = new Date(s.dateOfBirth!);
        return dob.getUTCMonth() + 1 === currentMonth && dob.getUTCDate() === currentDay;
      });
    } else if (period === 'week') {
      // Get birthdays in next 7 days
      const endDate = new Date(today);
      endDate.setUTCDate(endDate.getUTCDate() + 7);

      filteredSecretaries = filteredSecretaries.filter(s => {
        const dob = new Date(s.dateOfBirth!);
        const thisYearBirthday = nextBirthday(dob, today);
        return thisYearBirthday >= today && thisYearBirthday <= endDate;
      });
    } else if (period === 'month') {
      filteredSecretaries = filteredSecretaries.filter(s => {
        const dob = new Date(s.dateOfBirth!);
        return dob.getUTCMonth() + 1 === currentMonth;
      });
    }

    // Sort by the next birthday: nearest first, including year wrap-around.
    filteredSecretaries.sort((a, b) => {
      const distance = nextBirthday(new Date(a.dateOfBirth!), today).getTime()
        - nextBirthday(new Date(b.dateOfBirth!), today).getTime();
      return distance || a.fullName.localeCompare(b.fullName, 'vi');
    });

    // Add age calculation
    const result = filteredSecretaries.map(s => {
      const dob = new Date(s.dateOfBirth!);
      const birthday = nextBirthday(dob, today);
      const upcomingAge = birthday.getUTCFullYear() - dob.getUTCFullYear();

      return {
        ...s,
        age: upcomingAge,
        birthdayDay: dob.getUTCDate(),
        birthdayMonth: dob.getUTCMonth() + 1,
        isToday: sameUtcDate(birthday, today)
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching birthdays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch birthdays' },
      { status: 500 }
    );
  }
}
