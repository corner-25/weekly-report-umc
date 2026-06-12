import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { LicenseCategory, Prisma } from '@prisma/client';

// Vehicle-related categories now live under /dashboard/vehicles; the licenses
// stats here intentionally exclude them so the numbers match what users see
// on the Giấy phép page.
const EXCLUDED_CATEGORIES: LicenseCategory[] = ['VEHICLE', 'ADMIN_VEHICLE'];

export async function GET() {
  try {
    const today = new Date();
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + 90);

    const baseWhere: Prisma.LicenseWhereInput = {
      deletedAt: null,
      category: { notIn: EXCLUDED_CATEGORIES },
    };

    const [total, expired, expiringSoon, noExpiry] = await Promise.all([
      prisma.license.count({ where: baseWhere }),
      prisma.license.count({
        where: { ...baseWhere, expiryDate: { lt: today } },
      }),
      prisma.license.count({
        where: { ...baseWhere, expiryDate: { gte: today, lt: threshold } },
      }),
      prisma.license.count({
        where: { ...baseWhere, expiryDate: null },
      }),
    ]);

    return NextResponse.json({ total, expired, expiringSoon, noExpiry });
  } catch (error) {
    console.error('Error fetching license stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
