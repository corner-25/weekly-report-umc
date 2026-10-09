/**
 * Mã nạp dữ liệu cho script cào office chạy ở máy Phòng HC (header `x-import-token`
 * = WORK_IMPORT_TOKEN) — dùng chung cho nạp công việc, MOU và file đính kèm.
 */
import { timingSafeEqual } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HttpError } from '@/lib/crm/server';

export function importTokenMatches(provided: string): boolean {
  const expected = process.env.WORK_IMPORT_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cho phép script có mã nạp, hoặc quản trị viên đã đăng nhập (nạp tay từ giao diện).
 * Trả về tên người/nguồn nạp để ghi vết.
 */
export async function requireImporter(request: Request): Promise<string> {
  const token = request.headers.get('x-import-token');
  if (token !== null) {
    if (!importTokenMatches(token)) throw new HttpError(401, 'Mã nạp dữ liệu không đúng');
    return 'script';
  }
  const session = await getServerSession(authOptions);
  if (!session) throw new HttpError(401, 'Bạn cần đăng nhập');
  if (session.user.role !== 'ADMIN') throw new HttpError(403, 'Chỉ quản trị viên được nạp dữ liệu');
  return session.user.name ?? session.user.email ?? 'người dùng';
}
