import { NextResponse } from 'next/server';
import { handle, requireSession } from '@/lib/crm/server';
import { renderWorkReminderHtml, type WorkReminderStyle } from '@/lib/email/templates/work-reminder';
import { renderCrmFollowUpBriefingHtml } from '@/lib/email/templates/crm-followup';

function appUrl(request: Request): string {
  return process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
}

/**
 * Endpoint xem trước HTML trực tiếp trong trình duyệt hoặc iframe.
 * URL: /api/settings/email/preview?template=modern | minimal | formal | classic | crmBriefing
 */
export const GET = handle(async (request: Request) => {
  const url = appUrl(request);
  const searchParams = new URL(request.url).searchParams;
  const template = searchParams.get('template') || 'modern';

  if (template === 'crmBriefing') {
    const res = renderCrmFollowUpBriefingHtml({
      tomorrowDateStr: '10/10/2026',
      guests: [
        {
          id: 'vip-1',
          fullName: 'Trần Văn Minh',
          academicTitle: 'Ông',
          tier: 'VIP',
          organizationName: 'Tập đoàn Dược phẩm Quốc tế',
          phone: '0908 123 456',
          followUpNote: 'Hẹn chụp MRI sọ não 3.0 Tesla lúc 08:30 và đọc kết quả với PGS.TS Nguyễn Hoàng Bắc',
          destination: 'Phòng MRI 3.0T (Khu C) & Phòng khám VIP',
          doctors: ['PGS.TS.BS. Nguyễn Hoàng Bắc'],
          services: ['Khám bệnh', 'Chẩn đoán hình ảnh (MRI)', 'Xét nghiệm'],
          staffName: 'Nguyễn Lương Bảo Châu',
          companions: ['Nguyễn Thị Thảo Trang'],
        },
        {
          id: 'vip-2',
          fullName: 'Lê Thị Thu Cúc',
          academicTitle: 'Bà',
          tier: 'A',
          organizationName: 'Đại học Quốc gia TP.HCM',
          phone: '0913 987 654',
          followUpNote: 'Tái khám Tim mạch theo hẹn, làm siêu âm tim và lấy thuốc định kỳ',
          destination: 'Khoa Khám bệnh - Phòng Tim mạch VIP',
          doctors: ['TS.BS. Trương Quang Bình'],
          services: ['Khám bệnh', 'Thăm dò chức năng', 'Nhận thuốc'],
          staffName: 'Vũ Thị Bích Thảo',
          companions: [],
        },
      ],
      appUrl: url,
    });
    return new NextResponse(res.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Mẫu đôn đốc công việc
  const validStyle: WorkReminderStyle =
    template === 'modern' || template === 'formal' || template === 'classic'
      ? template
      : 'minimal';

  const res = renderWorkReminderHtml(
    {
      recipientName: '',
      department: 'Khoa Ngoại Tiêu hoá',
      items: [
        {
          id: 'sample-1',
          title: 'Triển khai kỹ thuật phẫu thuật nội soi 3D ít xâm lấn và hoàn tất quy trình chuẩn',
          status: 'Đang thực hiện',
          dueDate: '2026-10-15',
          reasonText: 'Sắp đến hạn (còn 6 ngày)',
          isOverdue: false,
          daysWithoutActivity: 45,
          daysOverdue: 0,
        },
        {
          id: 'sample-2',
          title: 'Báo cáo nghiệm thu đề tài cấp cơ sở về hiệu quả hồi phục sớm sau phẫu thuật (ERAS)',
          status: 'Đang thực hiện',
          dueDate: '2026-10-01',
          reasonText: 'Đã quá hạn 8 ngày',
          isOverdue: true,
          daysWithoutActivity: 115,
          daysOverdue: 8,
        },
        {
          id: 'sample-3',
          title: 'Rà soát danh mục vật tư tiêu hao chuyên khoa và đề xuất kế hoạch đấu thầu Quý IV',
          status: 'Chưa thực hiện',
          dueDate: '2026-09-20',
          reasonText: 'Đã quá hạn 19 ngày',
          isOverdue: true,
          daysWithoutActivity: 68,
          daysOverdue: 19,
        },
      ],
      appUrl: url,
    },
    validStyle
  );

  return new NextResponse(res.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
