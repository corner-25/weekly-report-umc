/**
 * Dọn dữ liệu do pipeline AI đời trước tạo ra.
 *
 * Sau khi pipeline mới nạp đủ 21 tuần, các bản ghi cũ trở thành trùng lặp: cùng
 * một tuần có hai bộ nhiệm vụ gắn với hai bộ MasterTask khác nhau, khiến báo cáo
 * hiển thị nhiệm vụ lặp.
 *
 * MẶC ĐỊNH CHẠY THỬ. Phải truyền --confirm mới thật sự xoá.
 *
 * Chạy:
 *   npx tsx prisma/cleanup-legacy-tasks.ts            # xem trước, không xoá
 *   npx tsx prisma/cleanup-legacy-tasks.ts --confirm  # xoá thật
 */
import { PrismaClient } from '@prisma/client';

/** Tuần phải có đủ bấy nhiêu bản ghi mới của một phòng thì mới coi là đã nạp xong. */
const MIN_NEW_RECORDS_PER_WEEK = 10;

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  // Chỉ xoá bản ghi cũ của những tuần ĐÃ có dữ liệu mới đầy đủ. Tuần chưa nạp
  // thì giữ nguyên, nếu không báo cáo tuần đó sẽ trống.
  const weeks = await prisma.week.findMany({
    select: {
      id: true,
      year: true,
      weekNumber: true,
      _count: { select: { taskProgress: true } },
    },
    orderBy: [{ year: 'asc' }, { weekNumber: 'asc' }],
  });

  const stats: Array<{ week: string; newCount: number; oldCount: number; safe: boolean }> = [];

  for (const w of weeks) {
    const [newCount, oldCount] = await Promise.all([
      prisma.weekTaskProgress.count({
        where: { weekId: w.id, extractionModel: { not: null } },
      }),
      prisma.weekTaskProgress.count({
        where: { weekId: w.id, extractionModel: null },
      }),
    ]);
    stats.push({
      week: `${w.weekNumber}/${w.year}`,
      newCount,
      oldCount,
      safe: newCount >= MIN_NEW_RECORDS_PER_WEEK,
    });
  }

  console.log(`${'Tuần'.padStart(9)}  ${'Mới'.padStart(5)}  ${'Cũ'.padStart(5)}   Trạng thái`);
  for (const s of stats) {
    const status = s.oldCount === 0 ? 'đã sạch' : s.safe ? 'SẼ XOÁ bản ghi cũ' : 'GIỮ — chưa nạp đủ';
    console.log(
      `${s.week.padStart(9)}  ${String(s.newCount).padStart(5)}  ` +
        `${String(s.oldCount).padStart(5)}   ${status}`,
    );
  }

  const safeWeekIds = weeks
    .filter((w, i) => stats[i].safe && stats[i].oldCount > 0)
    .map((w) => w.id);

  const toDelete = await prisma.weekTaskProgress.count({
    where: { weekId: { in: safeWeekIds }, extractionModel: null },
  });

  // MasterTask cũ nào sẽ không còn bản ghi nào sau khi xoá.
  const legacyTasks = await prisma.masterTask.findMany({
    where: { sourceType: { not: 'AI_GROUPED' } },
    select: { id: true, name: true, _count: { select: { weekProgress: true } } },
  });
  const orphaned = await Promise.all(
    legacyTasks.map(async (t) => {
      const remaining = await prisma.weekTaskProgress.count({
        where: { masterTaskId: t.id, NOT: { weekId: { in: safeWeekIds }, extractionModel: null } },
      });
      return { ...t, remaining };
    }),
  );
  const emptyTasks = orphaned.filter((t) => t.remaining === 0);

  console.log(`\n═══ TÓM TẮT ═══`);
  console.log(`Bản ghi cũ sẽ xoá:        ${toDelete}`);
  console.log(`MasterTask cũ thành rỗng: ${emptyTasks.length}/${legacyTasks.length}`);
  console.log(`Tuần chưa nạp đủ (giữ):   ${stats.filter((s) => !s.safe && s.oldCount > 0).length}`);

  if (!confirm) {
    console.log(`\n⚠ CHẠY THỬ — chưa xoá gì. Thêm --confirm để xoá thật.`);
    await prisma.$disconnect();
    return;
  }

  const deleted = await prisma.weekTaskProgress.deleteMany({
    where: { weekId: { in: safeWeekIds }, extractionModel: null },
  });
  console.log(`\n✓ Đã xoá ${deleted.count} bản ghi cũ`);

  // MasterTask rỗng: đánh dấu ngừng dùng thay vì xoá, để không mất lịch sử và
  // không phá khoá ngoại nếu còn nơi nào tham chiếu.
  if (emptyTasks.length > 0) {
    const updated = await prisma.masterTask.updateMany({
      where: { id: { in: emptyTasks.map((t) => t.id) } },
      data: { isActive: false },
    });
    console.log(`✓ Đã ngừng kích hoạt ${updated.count} MasterTask cũ không còn dùng`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
