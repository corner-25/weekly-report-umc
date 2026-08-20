import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Chỉ còn hai dashboard được duy trì, mỗi cái là một service Streamlit riêng
  // trên Railway (mã nguồn trong thư mục dashboards/).
  return NextResponse.json({
    'to-xe': process.env.DASHBOARD_TO_XE_URL ?? null,
    'phong-hc-old': process.env.DASHBOARD_PHONG_HC_OLD_URL ?? null,
  });
}
