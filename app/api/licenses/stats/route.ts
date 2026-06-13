import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const today = new Date();
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + 90);

    const [total, expired, expiringSoon, noExpiry] = await Promise.all([
      prisma.license.count({ where: { deletedAt: null } }),
      prisma.license.count({
        where: { deletedAt: null, expiryDate: { lt: today } },
      }),
      prisma.license.count({
        where: {
          deletedAt: null,
          expiryDate: { gte: today, lt: threshold },
        },
      }),
      prisma.license.count({
        where: { deletedAt: null, expiryDate: null },
      }),
    ]);

    return NextResponse.json({ total, expired, expiringSoon, noExpiry });
  } catch (error) {
    console.error('Error fetching license stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
