import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

const CACHE_TAG_MOU_STATS = 'mou-stats';

const getCachedMOUStats = unstable_cache(
  async () => {
    const today = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 90);

    const [total, active, expiringSoon, expired, draft, byCategory] = await Promise.all([
      prisma.mOU.count({ where: { deletedAt: null } }),
      prisma.mOU.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          OR: [{ expiryDate: null }, { expiryDate: { gt: today } }],
        },
      }),
      prisma.mOU.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          expiryDate: { lte: soon, gt: today },
        },
      }),
      prisma.mOU.count({
        where: {
          deletedAt: null,
          expiryDate: { lte: today },
          status: { not: 'TERMINATED' },
        },
      }),
      prisma.mOU.count({ where: { deletedAt: null, status: 'DRAFT' } }),
      prisma.mOU.groupBy({
        by: ['category'],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      expiringSoon,
      expired,
      draft,
      byCategory: byCategory.map(c => ({ category: c.category, count: c._count })),
    };
  },
  [CACHE_TAG_MOU_STATS],
  { revalidate: 120, tags: [CACHE_TAG_MOU_STATS] }
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getCachedMOUStats();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching MOU stats:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
