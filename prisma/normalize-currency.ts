/**
 * Chuẩn hoá metric tiền tệ về một đơn vị duy nhất: VND.
 *
 * Trước khi có script này, cùng một loại số tiền được lưu bốn kiểu — VND, đồng,
 * triệu đồng, tỷ đồng — và hai kiểu sau lưu giá trị ở thang khác hẳn. Cộng gộp
 * hay so sánh giữa các tuần vì thế cho ra số vô nghĩa: một khoản 3.097 tỷ trông
 * nhỏ hơn một khoản 500 triệu ghi bằng VND.
 *
 * Có thêm một lỗi tinh vi hơn: dấu chấm trong tiếng Việt là dấu phân cách hàng
 * nghìn, nhưng AI đôi khi đọc thành dấu thập phân. Cùng một câu "tổng giá trị
 * hơn 2.633 tỉ" ra 2.633 ở tuần này và 2633 ở tuần khác — lệch nhau 1000 lần.
 * Script phát hiện bằng cách đối chiếu lại với `sourceText`.
 *
 *   npx tsx prisma/normalize-currency.ts            # chạy thử, không ghi
 *   npx tsx prisma/normalize-currency.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { backupBeforeWrite } from '@/lib/db-backup';

/** Hệ số quy đổi mỗi đơn vị về VND. */
const TO_VND: Record<string, number> = {
  'vnd': 1,
  'vnđ': 1,
  'đ': 1,
  'đồng': 1,
  'nghìn đồng': 1_000,
  'triệu': 1_000_000,
  'triệu đồng': 1_000_000,
  'tỷ': 1_000_000_000,
  'tỉ': 1_000_000_000,
  'tỷ đồng': 1_000_000_000,
  'tỉ đồng': 1_000_000_000,
};

/**
 * Các đơn vị chứa chữ "đồng" nhưng KHÔNG phải tiền: "hợp đồng", "Hội đồng",
 * "phụ lục hợp đồng". Lọc bằng danh sách trắng ở trên nên chúng tự động bị bỏ
 * qua, nhưng liệt kê ra đây để người đọc sau biết là đã cân nhắc.
 */

/**
 * Đọc lại con số từ văn bản gốc, xử lý dấu chấm theo quy ước tiếng Việt.
 *
 * "2.633 tỉ" → 2633 (dấu chấm ngăn hàng nghìn, không phải thập phân).
 * Quy tắc: nếu sau dấu chấm cuối cùng có đúng 3 chữ số thì đó là dấu ngăn nghìn.
 *
 * Trả về null khi không chắc chắn — thà giữ nguyên giá trị cũ còn hơn ghi đè
 * bằng một số đọc nhầm. Hai trường hợp trả null:
 *
 *  - Văn bản có nhiều số cùng đơn vị: "thay đổi hạn mức từ 1 tỷ lên 2 tỷ" —
 *    không biết con số nào mới là chỉ số cần lấy.
 *  - Không tìm thấy số nào đứng trước đơn vị.
 */
function rereadFromSource(sourceText: string, unit: string): number | null {
  // Đơn vị lưu trong DB là "tỉ đồng" nhưng văn bản có thể chỉ viết "tỉ". Khớp
  // theo phần thang đo (triệu/tỷ/tỉ), bỏ chữ "đồng" đi cho linh hoạt.
  const scale = unit.replace(/\s*đồng\s*/g, '').trim();
  const scalePattern = /tỷ|tỉ/.test(scale) ? '(?:tỷ|tỉ)' : scale;
  // Không dùng \b sau thang đo: ranh giới từ của JS không nhận ký tự tiếng Việt
  // có dấu, nên "tỉ" sẽ khớp cả bên trong "tỉ đồng" và đếm thành hai lần.
  const pattern = new RegExp(`([\\d.,]+)\\s*${scalePattern}`, 'gi');

  // Gom theo vị trí con số, không theo số lần khớp — cùng một con số có thể
  // khớp nhiều lần khi đơn vị viết dài ("2 tỉ" và "2 tỉ đồng" là một).
  const positions = new Set<number>();
  const matches = [...sourceText.matchAll(pattern)];
  for (const m of matches) positions.add(m.index ?? -1);

  // Nhiều con số khác nhau cùng đơn vị trong một câu ("từ 1 tỷ lên 2 tỷ") →
  // không đủ căn cứ để chọn, thà giữ nguyên còn hơn ghi đè sai.
  if (positions.size !== 1) return null;

  const raw = matches[0][1].replace(/,/g, '.');
  const parts = raw.split('.');
  if (parts.length === 1) return Number(parts[0]);

  const last = parts[parts.length - 1];
  // Đúng 3 chữ số sau dấu chấm cuối → dấu ngăn hàng nghìn.
  const value = last.length === 3 ? Number(parts.join('')) : Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const metrics = await prisma.extractedMetric.findMany({
    where: { unit: { in: Object.keys(TO_VND).flatMap((u) => [u, u.toUpperCase()]) } },
    select: { id: true, name: true, value: true, unit: true, sourceText: true },
  });

  console.log(`${metrics.length} metric tiền tệ\n`);

  const changes: Array<{ id: string; from: string; to: number; note: string }> = [];
  let misreadCount = 0;

  for (const m of metrics) {
    const unitKey = (m.unit ?? '').toLowerCase().trim();
    const factor = TO_VND[unitKey];
    if (factor === undefined) continue;

    let value = m.value;

    // Với đơn vị lớn (triệu/tỷ), đọc lại từ nguồn để bắt lỗi dấu chấm.
    if (factor >= 1_000_000 && m.sourceText) {
      const reread = rereadFromSource(m.sourceText, unitKey);
      if (reread !== null && Math.abs(reread - value) > 0.001) {
        misreadCount++;
        value = reread;
      }
    }

    const vnd = Math.round(value * factor);
    if (vnd === Math.round(m.value) && unitKey === 'vnd') continue;

    changes.push({
      id: m.id,
      from: `${m.value} ${m.unit}`,
      to: vnd,
      note: `${m.name.slice(0, 34)}`,
    });
  }

  console.log(`Cần sửa: ${changes.length} metric`);
  console.log(`Trong đó ${misreadCount} bị đọc sai dấu chấm (lệch 1000 lần)\n`);

  for (const c of changes.slice(0, 15)) {
    console.log(`  ${c.note.padEnd(36)} ${c.from.padStart(18)} → ${c.to.toLocaleString('vi-VN')} VND`);
  }
  if (changes.length > 15) console.log(`  … và ${changes.length - 15} metric nữa`);

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  // Sao lưu trước khi ghi — script sửa hàng loạt không lùi được.
  console.log('Sao lưu:');
  await backupBeforeWrite(prisma, ['extracted_metrics'], 'currency');

  for (const c of changes) {
    await prisma.extractedMetric.update({
      where: { id: c.id },
      data: { value: c.to, unit: 'VND' },
    });
  }
  console.log(`\n✓ Đã chuẩn hoá ${changes.length} metric về VND`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
