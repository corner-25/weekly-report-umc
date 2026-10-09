import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { importWorkPayload } from '@/lib/work/import';
import { handle, HttpError } from '@/lib/crm/server';
import { importTokenMatches } from '@/lib/import-token';

export const maxDuration = 300;

/** File cào vài nghìn việc kèm lịch sử cập nhật vẫn dưới mức này. */
const MAX_BODY_BYTES = 25 * 1024 * 1024;

/**
 * Nạp file cào từ phân hệ Quản lý công việc.
 *
 * Hai cách gọi:
 *   - Script cào trong mạng UMC: header `x-import-token` = WORK_IMPORT_TOKEN, body là JSON
 *   - Người dùng đã đăng nhập: tải file .json lên ở trang Quản lý công việc
 */
export const POST = handle(async (request: Request) => {
  const token = request.headers.get('x-import-token');
  let triggeredBy: string;
  if (token !== null) {
    if (!importTokenMatches(token)) throw new HttpError(401, 'Mã nạp dữ liệu không đúng');
    triggeredBy = 'script';
  } else {
    const session = await getServerSession(authOptions);
    if (!session) throw new HttpError(401, 'Bạn cần đăng nhập');
    triggeredBy = session.user.name ?? session.user.email ?? 'người dùng';
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'File quá 25 MB — chia nhỏ theo khoảng ngày rồi nạp từng phần');

  let body: unknown;
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const file = (await request.formData()).get('file');
      if (!(file instanceof File)) throw new HttpError(400, 'Chưa chọn file');
      body = JSON.parse(await file.text());
    } else {
      body = await request.json();
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'File không phải JSON hợp lệ');
  }

  const summary = await importWorkPayload(prisma, body, { triggeredBy });
  return NextResponse.json(summary);
});
