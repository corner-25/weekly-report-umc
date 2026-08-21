/**
 * Chạy pipeline gom nghiệp vụ cho toàn bộ phòng ban.
 *
 * Đọc dữ liệu nhiệm vụ đã trích từ file Excel báo cáo tuần bệnh viện, gọi AI gom
 * thành nghiệp vụ thường quy, rồi lưu thành MasterTask kèm aliases.
 *
 * Chạy:
 *   npx tsx prisma/run-ai-grouping.ts [--auto-approve] [--dept="TÊN PHÒNG"]
 *
 * Biến môi trường:
 *   TASKS_FILE     đường dẫn JSON nhiệm vụ (mặc định /tmp/all_tasks.json)
 *   DEPT_MAP_FILE  ánh xạ tên phòng Excel → id trong DB
 *   TOTAL_WEEKS    tổng số tuần trong dữ liệu (mặc định 33)
 */
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { runGroupingForDepartment } from '@/lib/ai/pipeline';
import type { TaskContext } from '@/lib/ai/prompts';

const TASKS_FILE = process.env.TASKS_FILE ?? '/tmp/all_tasks.json';
const DEPT_MAP_FILE = process.env.DEPT_MAP_FILE ?? '/tmp/dept_map.json';
const TOTAL_WEEKS = Number(process.env.TOTAL_WEEKS ?? 33);

interface RawTask {
  dept: string;
  ten: string;
  nhom_cha: string | null;
  so_tuan: number;
  tien_do: number[];
  ket_qua: string[];
}

async function main() {
  const autoApprove = process.argv.includes('--auto-approve');
  const only = process.argv.find((a) => a.startsWith('--dept='))?.slice(7);

  const raw = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')) as RawTask[];
  const deptMap = JSON.parse(fs.readFileSync(DEPT_MAP_FILE, 'utf8')) as Record<string, string>;
  const prisma = new PrismaClient();

  const byDept = new Map<string, TaskContext[]>();
  for (const t of raw) {
    if (only && t.dept !== only) continue;
    const list = byDept.get(t.dept) ?? [];
    list.push({
      name: t.ten,
      weekCount: t.so_tuan,
      totalWeeks: TOTAL_WEEKS,
      parentGroup: t.nhom_cha,
      sampleResults: t.ket_qua,
      progressSeries: t.tien_do,
    });
    byDept.set(t.dept, list);
  }

  console.log(`${byDept.size} phòng · tự duyệt: ${autoApprove ? 'CÓ' : 'không'}\n`);

  let totalTokens = 0;
  let totalAreas = 0;
  const failures: Array<{ dept: string; error: string }> = [];

  // Phòng ít nhiệm vụ chạy trước để lộ lỗi sớm, đỡ tốn token nếu có gì sai.
  const ordered = [...byDept.entries()].sort((a, b) => a[1].length - b[1].length);

  for (const [deptName, tasks] of ordered) {
    const departmentId = deptMap[deptName];
    if (!departmentId) {
      failures.push({ dept: deptName, error: 'Không tìm thấy phòng trong database' });
      console.log(`✗ ${deptName} — không khớp phòng trong DB`);
      continue;
    }

    process.stdout.write(`▸ ${deptName} (${tasks.length} nhiệm vụ)… `);
    try {
      const summary = await runGroupingForDepartment(departmentId, deptName, tasks, {
        db: prisma,
        autoApprove,
      });
      totalTokens += summary.totalTokens;
      totalAreas += summary.areasCreated;

      const warn = summary.lowConfidence > 0 ? ` · ${summary.lowConfidence} tin cậy thấp` : '';
      const miss = summary.unassigned.length > 0 ? ` · ${summary.unassigned.length} SÓT` : '';
      console.log(
        `${summary.areasCreated} nghiệp vụ · ${summary.tasksAssigned}/${tasks.length}` +
          `${warn}${miss} · ${Math.round(summary.durationMs / 1000)}s`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ dept: deptName, error: message });
      console.log(`LỖI: ${message.slice(0, 90)}`);
    }
  }

  console.log('\n═══ TỔNG ═══');
  console.log(`${totalAreas} nghiệp vụ · ${totalTokens.toLocaleString('vi-VN')} tokens`);
  if (failures.length > 0) {
    console.log(`\n${failures.length} phòng lỗi:`);
    for (const f of failures) console.log(`  ${f.dept}: ${f.error.slice(0, 100)}`);
  }

  await prisma.$disconnect();
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
