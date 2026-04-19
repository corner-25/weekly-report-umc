import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import type { Prisma } from '@prisma/client';
import {
  CATEGORY_LABELS, STATUS_LABELS, getMOUDisplayStatus, getDaysUntilExpiry, getOverallProgress,
} from '@/components/mous/MOUUtils';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const departmentId = searchParams.get('departmentId');

    const AND: Prisma.MOUWhereInput[] = [{ deletedAt: null }];

    if (search) {
      AND.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { partnerName: { contains: search, mode: 'insensitive' } },
          { mouNumber: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (category) AND.push({ category: category as any });
    if (departmentId) AND.push({ departmentId });
    if (status) {
      const today = new Date();
      const soon = new Date();
      soon.setDate(soon.getDate() + 90);
      switch (status) {
        case 'ACTIVE':
          AND.push({ status: 'ACTIVE' });
          AND.push({ OR: [{ expiryDate: null }, { expiryDate: { gt: soon } }] });
          break;
        case 'EXPIRING':
          AND.push({ status: 'ACTIVE' });
          AND.push({ expiryDate: { lte: soon, gt: today } });
          break;
        case 'EXPIRED':
          AND.push({ status: { in: ['EXPIRED', 'ACTIVE'] } });
          AND.push({ expiryDate: { lte: today } });
          break;
        case 'DRAFT': AND.push({ status: 'DRAFT' }); break;
        case 'TERMINATED': AND.push({ status: 'TERMINATED' }); break;
      }
    }

    const mous = await prisma.mOU.findMany({
      where: { AND },
      include: {
        department: { select: { name: true } },
        clauses: { select: { progress: true } },
        _count: { select: { clauses: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '';

    const rows = mous.map((m, i) => {
      const displayStatus = getMOUDisplayStatus({
        status: m.status,
        expiryDate: m.expiryDate ? m.expiryDate.toISOString() : null,
      });
      const daysLeft = getDaysUntilExpiry(m.expiryDate ? m.expiryDate.toISOString() : null);
      const progress = m.clauses.length > 0 ? getOverallProgress(m.clauses) : null;

      return {
        STT: i + 1,
        'Số hiệu': m.mouNumber || '',
        'Tên MOU': m.title,
        'Loại': CATEGORY_LABELS[m.category] || m.category,
        'Đối tác': m.partnerName,
        'Quốc gia': m.partnerCountry || '',
        'Phòng đầu mối': m.department?.name || '',
        'Người phụ trách': m.contactPerson || '',
        'Email': m.contactEmail || '',
        'Điện thoại': m.contactPhone || '',
        'Ngày ký': fmtDate(m.signedDate),
        'Ngày hiệu lực': fmtDate(m.effectiveDate),
        'Ngày hết hạn': fmtDate(m.expiryDate),
        'Còn lại (ngày)': daysLeft !== null ? daysLeft : '',
        'Trạng thái': STATUS_LABELS[displayStatus] || displayStatus,
        'Tự gia hạn': m.autoRenew ? 'Có' : 'Không',
        'Số hạng mục': m._count.clauses,
        'Tiến độ (%)': progress !== null ? progress : '',
        'Mục đích': m.purpose || '',
        'Ghi chú': m.notes || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 28 },
      { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách MOU');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const filename = `MOU_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error exporting MOUs:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra khi xuất file' }, { status: 500 });
  }
}
