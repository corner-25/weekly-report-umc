/**
 * Số liệu định lượng do AI trích từ báo cáo tuần.
 *
 * Thay cho `/api/week-metrics`, vốn đọc bảng `WeekMetricValue` — số liệu nhập
 * tay theo danh mục dựng sẵn. Bảng đó dừng ở tuần 22 vì từ khi pipeline AI chạy
 * thì không ai nhập tay nữa, trong khi `ExtractedMetric` đã có hơn 8.600 bản
 * ghi trải 31 tuần.
 *
 * Khác biệt về hình dạng dữ liệu: `WeekMetricValue` trỏ tới một `Metric` có sẵn
 * (danh mục cố định), còn `ExtractedMetric` mang thẳng tên và đơn vị trong bản
 * ghi — mỗi tuần AI trích ra tên gì thì lưu tên đó. Nên ở đây gom theo tên để
 * dựng lại danh mục cho giao diện lọc.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Giới hạn số bản ghi trả về.
 *
 * Bảng hiển thị dạng lưới tên × tuần; quá ngần này thì trình duyệt dựng lưới rất
 * chậm mà người xem cũng không đọc hết. Lọc theo phòng ban để thu hẹp.
 */
const MAX_ROWS = 12_000;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const departmentId = searchParams.get('departmentId');

  const metrics = await prisma.extractedMetric.findMany({
    where: {
      ...(year ? { week: { year: Number(year) } } : {}),
      ...(departmentId && departmentId !== 'all' ? { departmentId } : {}),
    },
    select: {
      id: true,
      name: true,
      value: true,
      unit: true,
      period: true,
      asOfDate: true,
      sourceText: true,
      confidence: true,
      reviewStatus: true,
      department: { select: { id: true, name: true } },
      week: {
        select: { id: true, weekNumber: true, year: true, startDate: true, endDate: true },
      },
    },
    orderBy: [{ week: { weekNumber: 'desc' } }, { name: 'asc' }],
    take: MAX_ROWS,
  });

  return NextResponse.json(metrics);
}
