/**
 * Trích lại số liệu báo cáo bệnh viện theo danh mục chuẩn, nhiều phòng-tuần song song.
 *
 * Chỉ trích lại SỐ LIỆU (extracted_metrics, bản chưa duyệt) — nhiệm vụ đã khớp
 * giữ nguyên. Phòng-tuần còn là bản chép y hệt tuần trước thì bỏ qua.
 *
 * Chạy:
 *   npx tsx prisma/reextract-metrics.ts --dept "Phòng Hành chính" --dept "Phòng Điều dưỡng"
 *   npx tsx prisma/reextract-metrics.ts --all --weeks 30-40 --concurrency 4 --model glm-5.2
 *   npx tsx prisma/reextract-metrics.ts --all --weeks 25-40 --model glm-5.2 --skip-done   # chạy tiếp lượt bị ngắt
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { downloadSharedFile } from '@/lib/ingestion/fetchers/onedrive-share';
import { parseHospitalReport } from '@/lib/ingestion/parsers/hospital-report';
import { extractWeekTasksByDepartment } from '@/lib/ingestion/parsers/hospital-week-tasks';
import { matchDepartment } from '@/lib/ingestion/parsers/department-matcher';
import { departmentContentHash, isUneditedCopy } from '@/lib/ingestion/parsers/department-snapshot';
import { reextractWeekMetrics } from '@/lib/ai/week-import';

/** Bị giới hạn tần suất (429) là chuyện thường khi chạy song song — thử lại, chờ lâu dần. */
const MAX_ATTEMPTS = 5;

function argValues(flag: string): string[] {
  return process.argv.flatMap((a, i) => (a === flag ? [process.argv[i + 1]] : []));
}

function parseWeeks(spec: string | undefined): (w: number) => boolean {
  if (!spec) return () => true;
  const [from, to] = spec.split('-').map(Number);
  return (w) => w >= from && w <= (to ?? from);
}

const prisma = new PrismaClient();

interface Job {
  departmentId: string;
  departmentName: string;
  year: number;
  week: number;
  tasks: ReturnType<typeof extractWeekTasksByDepartment>[number]['tasks'];
}

async function main(): Promise<void> {
  const wantedDepts = argValues('--dept');
  const all = process.argv.includes('--all');
  if (!all && wantedDepts.length === 0) throw new Error('Cần --dept "<tên phòng>" (lặp lại được) hoặc --all');
  const inWeeks = parseWeeks(argValues('--weeks')[0]);
  const concurrency = Number(argValues('--concurrency')[0] ?? 4);
  const model = argValues('--model')[0];

  const shareUrl = process.env.ONEDRIVE_HOSPITAL_REPORT_SHARE_URL;
  if (!shareUrl) throw new Error('Thiếu ONEDRIVE_HOSPITAL_REPORT_SHARE_URL');
  const { sheets } = parseHospitalReport((await downloadSharedFile(shareUrl)).buffer);

  const departments = await prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const byWeek = new Map(sheets.map((s) => [`${s.year}-${s.week}`, s]));

  // --skip-done: bỏ qua phòng-tuần đã có số liệu do chính model này trích —
  // để chạy tiếp lượt bị ngắt giữa chừng mà không trả tiền token lần nữa.
  const doneKeys = new Set<string>();
  if (process.argv.includes('--skip-done')) {
    if (!model) throw new Error('--skip-done cần đi kèm --model để biết lượt nào đã xong');
    const rows = await prisma.extractedMetric.findMany({
      where: { extractionModel: model },
      distinct: ['weekId', 'departmentId'],
      select: { departmentId: true, week: { select: { year: true, weekNumber: true } } },
    });
    for (const r of rows) doneKeys.add(`${r.departmentId}|${r.week.year}|${r.week.weekNumber}`);
  }

  const jobs: Job[] = [];
  let skippedCopies = 0;
  let skippedDone = 0;
  for (const sheet of sheets) {
    if (!inWeeks(sheet.week)) continue;
    const previous = byWeek.get(`${sheet.year}-${sheet.week - 1}`);
    const prevHash = new Map(
      (previous ? extractWeekTasksByDepartment(previous) : []).map((d) => [d.departmentName, departmentContentHash(d.tasks)]),
    );
    for (const dept of extractWeekTasksByDepartment(sheet)) {
      const match = matchDepartment(dept.departmentName, departments);
      if (!match.departmentId || !match.dbName) continue;
      if (!all && !wantedDepts.includes(match.dbName)) continue;
      if (isUneditedCopy(departmentContentHash(dept.tasks), prevHash.get(dept.departmentName), dept.tasks.length)) {
        skippedCopies += 1;
        continue;
      }
      if (doneKeys.has(`${match.departmentId}|${sheet.year}|${sheet.week}`)) {
        skippedDone += 1;
        continue;
      }
      jobs.push({ departmentId: match.departmentId, departmentName: match.dbName, year: sheet.year, week: sheet.week, tasks: dept.tasks });
    }
  }
  console.info(`${jobs.length} phòng-tuần cần trích · bỏ qua ${skippedCopies} bản chép, ${skippedDone} đã xong · ${concurrency} luồng song song`);

  let done = 0;
  let tokens = 0;
  const failed: string[] = [];
  const startedAt = Date.now();

  const runJob = async (job: Job): Promise<void> => {
    const label = `T${job.week} ${job.departmentName}`;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const r = await reextractWeekMetrics(prisma, {
          year: job.year, week: job.week, departmentId: job.departmentId,
          departmentName: job.departmentName, tasks: job.tasks,
        }, { model });
        tokens += r.tokens;
        done += 1;
        console.info(`✓ [${done}/${jobs.length}] ${label}: ${r.extracted} số liệu, ${r.flagged} cờ · ${r.tokens.toLocaleString('vi-VN')} token`);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  ${label} lỗi lần ${attempt}: ${message.slice(0, 160)}`);
        if (attempt === MAX_ATTEMPTS) failed.push(label);
        else await new Promise((r) => setTimeout(r, 15_000 * attempt));
      }
    }
  };

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (next < jobs.length) await runJob(jobs[next++]);
    }),
  );

  const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.info(`\nXong ${done}/${jobs.length} trong ${minutes} phút · ${tokens.toLocaleString('vi-VN')} token`);
  if (failed.length > 0) console.info(`THẤT BẠI (${failed.length}): ${failed.join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
