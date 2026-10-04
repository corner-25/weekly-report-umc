import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { buildDepartmentProfile } from '@/lib/department-profile';
import { compressedJson } from '@/lib/http/compressed-json';

/** Hồ sơ 360 của phòng ban — xem lib/department-profile.ts. */
export const GET = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  const profile = await buildDepartmentProfile(prisma, id);
  if (!profile) throw new HttpError(404, 'Không tìm thấy phòng ban');
  return compressedJson(request, profile, { headers: { 'Cache-Control': 'private, max-age=60' } });
});
