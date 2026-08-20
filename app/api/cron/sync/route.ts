import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runAllEnabled, runSource } from '@/lib/ingestion/runner';
import type { SyncTrigger } from '@/lib/ingestion/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Excel lớn + nhiều nguồn chạy tuần tự

/**
 * Chạy đồng bộ dữ liệu.
 *
 * Hai cách gọi:
 *   - Cron: header `x-cron-secret` khớp CRON_SECRET
 *   - Người dùng: đã đăng nhập, bấm nút trên trang quản trị
 *
 * Query params:
 *   - `source=<slug>`  chỉ chạy một nguồn (mặc định: mọi nguồn đang bật cron)
 *   - `force=1`        chạy cả khi checksum không đổi
 */
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const sourceId = url.searchParams.get('source');
  const force = url.searchParams.get('force') === '1';

  try {
    const results = sourceId
      ? [await runSource(sourceId, auth.trigger, { force })]
      : await runAllEnabled(auth.trigger);

    const failed = results.filter((r) => r.status === 'FAILED').length;

    return NextResponse.json({
      success: failed === 0,
      summary: `${results.length - failed}/${results.length} nguồn đồng bộ thành công`,
      results,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    // Chỉ tới đây khi lỗi nằm ngoài phạm vi một nguồn (vd: sourceId không tồn tại).
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    console.error('Cron sync error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type AuthResult =
  | { ok: true; trigger: SyncTrigger }
  | { ok: false; error: string; status: number };

async function authorize(request: Request): Promise<AuthResult> {
  const provided = request.headers.get('x-cron-secret');

  if (provided !== null) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return { ok: false, error: 'CRON_SECRET chưa được cấu hình', status: 500 };
    }
    if (!secretsMatch(provided, expected)) {
      return { ok: false, error: 'Unauthorized', status: 401 };
    }
    return { ok: true, trigger: 'cron' };
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }
  return { ok: true, trigger: 'manual' };
}

/** So sánh secret theo thời gian hằng định để tránh rò rỉ qua timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
