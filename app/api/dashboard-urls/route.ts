import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    'phong-hc': process.env.DASHBOARD_PHONG_HC_URL ?? null,
    'phong-hc-old': process.env.DASHBOARD_PHONG_HC_OLD_URL ?? null,
    'to-xe': process.env.DASHBOARD_TO_XE_URL ?? null,
    'umc': process.env.DASHBOARD_UMC_URL ?? null,
  });
}
