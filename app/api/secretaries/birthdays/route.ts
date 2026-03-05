import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Lấy danh sách sinh nhật
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month'; // today, week, month

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const secretaries = await prisma.secretary.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        dateOfBirth: { not: null }
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
        return dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay;
      });
    } else if (period === 'week') {
      // Get birthdays in next 7 days
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 7);

      filteredSecretaries = filteredSecretaries.filter(s => {
        const dob = new Date(s.dateOfBirth!);
        const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

        // If birthday already passed this year, check next year
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }

        return thisYearBirthday >= today && thisYearBirthday <= endDate;
      });
    } else if (period === 'month') {
      filteredSecretaries = filteredSecretaries.filter(s => {
        const dob = new Date(s.dateOfBirth!);
        return dob.getMonth() + 1 === currentMonth;
      });
    }

    // Sort by day of month
    filteredSecretaries.sort((a, b) => {
      const dayA = new Date(a.dateOfBirth!).getDate();
      const dayB = new Date(b.dateOfBirth!).getDate();
      return dayA - dayB;
    });

    // Add age calculation
    const result = filteredSecretaries.map(s => {
      const dob = new Date(s.dateOfBirth!);
      const age = today.getFullYear() - dob.getFullYear();
      const upcomingAge = age + (
        dob.getMonth() > today.getMonth() ||
        (dob.getMonth() === today.getMonth() && dob.getDate() > today.getDate())
          ? 0 : 1
      );

      return {
        ...s,
        age: upcomingAge,
        birthdayDay: dob.getDate(),
        birthdayMonth: dob.getMonth() + 1,
        isToday: dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay
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
