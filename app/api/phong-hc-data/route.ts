import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Số liệu Phòng HC cho dashboard native.
 *
 * Trước đây endpoint này tải file current_dashboard_data.json từ repo GitHub
 * dashboard-storage. File đó do một công cụ ngoài hệ thống đẩy lên, không có
 * gì trong repo này ghi vào nó, và nguồn 'hc-officeapi' vẫn để cronEnabled=false
 * — nên dashboard đứng yên ở lần upload tay gần nhất.
 *
 * Nay đọc thẳng bảng hc_metrics, chính là nơi luồng đồng bộ OneDrive
 * ('dept-report-onedrive') ghi vào mỗi lần chạy. Nhờ vậy dashboard tự cập nhật
 * theo cron thay vì chờ người đẩy file.
 *
 * Định dạng trả về giữ nguyên như cũ (khoá tiếng Việt + metadata) để phần
 * giao diện và lib/phong-hc/data-processing không phải sửa gì.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await prisma.hcMetric.findMany({
      select: {
        category: true,
        content: true,
        year: true,
        month: true,
        week: true,
        value: true,
      },
      orderBy: [{ year: 'asc' }, { week: 'asc' }, { category: 'asc' }],
    });

    if (rows.length === 0) {
      return NextResponse.json({
        data: [],
        columns: ['Danh mục', 'Nội dung', 'Năm', 'Tháng', 'Tuần', 'Số liệu'],
        metadata: {
          filename: 'hc_metrics (Postgres)',
          upload_time: new Date().toISOString(),
          week_number: 0,
          year: new Date().getFullYear(),
          row_count: 0,
          file_size_mb: 0,
          uploader: 'Đồng bộ OneDrive',
          replaced_backup: null,
        },
      });
    }

    const data = rows.map((r) => ({
      'Danh mục': r.category,
      'Nội dung': r.content,
      'Năm': r.year,
      // month cho phép null trong schema; dashboard suy từ tuần khi thiếu.
      'Tháng': r.month ?? Math.min(12, Math.ceil(r.week / 4.345)),
      'Tuần': r.week,
      'Số liệu': r.value,
    }));

    // Tuần mới nhất có số liệu — hiển thị trên nhãn "Tuần x/yyyy".
    const latest = rows.reduce((acc, r) =>
      r.year > acc.year || (r.year === acc.year && r.week > acc.week) ? r : acc
    );

    // Lần ghi gần nhất của luồng đồng bộ, để người xem biết dữ liệu tươi cỡ nào.
    const source = await prisma.syncSource.findUnique({
      where: { id: 'dept-report-onedrive' },
      select: { lastSuccessAt: true },
    });

    return NextResponse.json({
      data,
      columns: ['Danh mục', 'Nội dung', 'Năm', 'Tháng', 'Tuần', 'Số liệu'],
      metadata: {
        filename: 'Đồng bộ tự động từ OneDrive',
        upload_time: (source?.lastSuccessAt ?? new Date()).toISOString(),
        week_number: latest.week,
        year: latest.year,
        row_count: rows.length,
        file_size_mb: 0,
        uploader: 'Đồng bộ OneDrive',
        replaced_backup: null,
      },
    });
  } catch (error) {
    console.error('Error fetching Phòng HC data:', error);
    return NextResponse.json(
      {
        error: `Không đọc được số liệu: ${
          error instanceof Error ? error.message : 'Unknown'
        }`,
      },
      { status: 500 }
    );
  }
}
