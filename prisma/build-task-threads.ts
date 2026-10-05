/**
 * Dựng / cập nhật "việc" theo dõi từ file báo cáo bệnh viện (xem docs/TASK-TRACKING.md).
 *
 *   npx tsx prisma/build-task-threads.ts                       # mọi phòng, năm nay: nối + AI đánh giá việc mới đổi
 *   npx tsx prisma/build-task-threads.ts --dept "Phòng Bảo hiểm Y tế" --force   # đánh giá lại toàn bộ việc của phòng
 *   npx tsx prisma/build-task-threads.ts --no-judge            # chỉ nối, không gọi AI
 *   npx tsx prisma/build-task-threads.ts --concurrency 4
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { downloadSharedFile } from '@/lib/ingestion/fetchers/onedrive-share';
import { parseHospitalReport } from '@/lib/ingestion/parsers/hospital-report';
import { rowsFromSheets, syncDepartment } from '@/lib/task-tracking/pipeline';

const prisma = new PrismaClient();
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main(): Promise<void> {
  const shareUrl = process.env.ONEDRIVE_HOSPITAL_REPORT_SHARE_URL;
  if (!shareUrl) throw new Error('Thiếu ONEDRIVE_HOSPITAL_REPORT_SHARE_URL');
  const year = Number(arg('--year') ?? new Date().getFullYear());
  const onlyDept = arg('--dept');
  const concurrency = Number(arg('--concurrency') ?? 4);
  const judge = !process.argv.includes('--no-judge');
  const force = process.argv.includes('--force');

  const { sheets } = parseHospitalReport((await downloadSharedFile(shareUrl)).buffer);
  const departments = await prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const all = rowsFromSheets(sheets, departments, year).filter((d) => !onlyDept || d.departmentName === onlyDept);
  console.info(`${all.length} phòng · ${sheets.filter((s) => s.year === year).length} tuần trong file · ${judge ? 'có' : 'không'} gọi AI`);

  let totalTokens = 0;
  const queue = [...all];
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      const started = Date.now();
      try {
        const r = await syncDepartment(prisma, d, { judge, force, log: (m) => console.warn(`  ${m}`) });
        totalTokens += r.tokens;
        console.info(
          `✓ ${d.departmentName}: ${r.entries} dòng nối lại${r.linkedFromWeek ? ` từ tuần ${r.linkedFromWeek}` : ''} · kiểu ${r.style} · ` +
            `luồng thường kỳ mới ${"routineStreams" in r ? r.routineStreams : 0} · AI ${r.judged} việc${r.failed ? `, lỗi ${r.failed}` : ''} · ${r.tokens.toLocaleString('vi-VN')} token · ${((Date.now() - started) / 1000).toFixed(0)}s`,
        );
      } catch (error) {
        console.error(`✗ ${d.departmentName}: ${error instanceof Error ? error.message : error}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, all.length) }, worker));
  console.info(`Xong · ${totalTokens.toLocaleString('vi-VN')} token`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
