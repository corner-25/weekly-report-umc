import { describe, expect, it } from 'vitest';
import { parseEmailList } from './reminders';
import { renderWorkReminderHtml } from '@/lib/email/templates/work-reminder';

describe('parseEmailList', () => {
  it('parses single and multiple emails with commas, semicolons, and spaces', () => {
    const raw = 'thuky1@umc.edu.vn, thuky2@umc.edu.vn; truongphong@umc.edu.vn   thuky1@umc.edu.vn';
    const result = parseEmailList(raw);
    expect(result).toEqual([
      'thuky1@umc.edu.vn',
      'thuky2@umc.edu.vn',
      'truongphong@umc.edu.vn',
    ]);
  });

  it('filters out invalid emails and trims lowercase', () => {
    const raw = 'INVALID_EMAIL, Admin@UMC.EDU.VN, notanemail@, @nodomain.com';
    const result = parseEmailList(raw);
    expect(result).toEqual(['admin@umc.edu.vn']);
  });

  it('returns empty array on empty or whitespace string', () => {
    expect(parseEmailList('')).toEqual([]);
    expect(parseEmailList('   ')).toEqual([]);
  });
});

describe('renderWorkReminderHtml', () => {
  const baseItem = {
    id: 'item-1',
    title: 'Báo cáo rà soát công tác hành chính',
    status: 'Đang thực hiện',
    dueDate: '2026-10-15',
    reasonText: 'Đã quá hạn 5 ngày',
    isOverdue: true,
  };

  it('renders salutation with department focal point when recipientName is omitted', () => {
    const res = renderWorkReminderHtml({
      department: 'Phòng Kế hoạch tổng hợp',
      items: [baseItem],
      appUrl: 'https://umc.vn',
    });

    expect(res.html).toContain('Kính gửi: Đầu mối phụ trách công việc &middot; Phòng Kế hoạch tổng hợp,');
    expect(res.html).toContain('Trân trọng cảm ơn sự phối hợp kịp thời của Quý đơn vị.');
    expect(res.subject).toBe('[UMC-Office] Đôn đốc tiến độ 1 nhiệm vụ của Phòng Kế hoạch tổng hợp cần cập nhật báo cáo');
  });

  it('renders individual name when recipientName is explicitly provided', () => {
    const res = renderWorkReminderHtml({
      recipientName: 'Nguyễn Văn A',
      department: 'Phòng Tổ chức cán bộ',
      items: [baseItem],
      appUrl: 'https://umc.vn',
    });

    expect(res.html).toContain('Kính gửi: Anh/Chị Nguyễn Văn A (Đầu mối phụ trách &middot; Phòng Tổ chức cán bộ),');
    expect(res.html).toContain('Trân trọng cảm ơn sự phối hợp kịp thời của Anh/Chị và đơn vị.');
  });
});

