import { NextRequest, NextResponse } from 'next/server';
import { sendBirthdayEmails } from '@/lib/birthday-email';

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(expected && provided && expected === provided);
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
    return NextResponse.json(await sendBirthdayEmails({ dryRun }));
  } catch (error) {
    console.error('Birthday email cron failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Birthday email failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
