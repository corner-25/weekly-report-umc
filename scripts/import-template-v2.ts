/**
 * Script import dữ liệu từ Template Excel v2 (đã chuẩn bị kỹ)
 *
 * Sheet 1: Departments - Danh sách phòng ban
 * Sheet 2: MasterTask - Nhiệm vụ định tính + báo cáo tuần
 * Sheet 3: Data - Điểm dữ liệu định lượng
 *
 * Chạy: npx tsx scripts/import-template-v2.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

// Railway Database URL
const DATABASE_URL = 'postgresql://postgres:YYEGqWdLqchHITKHhtQFwrwSHMBeYYBE@caboose.proxy.rlwy.net:46621/railway';

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
  log: ['warn', 'error'],
});

const TEMPLATE_FILE = path.join(__dirname, '../data-push-railway/TEMPLATE_import_data.xlsx');
const YEAR = 2026;

// ==================== HELPER FUNCTIONS ====================

function normalizeDepName(name: string): string {
  // Normalize department names for matching
  return name
    .toUpperCase()
    .replace(/PHÒNG\s+/gi, 'PHÒNG ')
    .replace(/TRUNG TÂM\s+/gi, 'TRUNG TÂM ')
    .replace(/ĐƠN VỊ\s+/gi, 'ĐƠN VỊ ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWeekDates(weekNumber: number, year: number): { startDate: Date; endDate: Date } {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  return { startDate, endDate };
}

function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle "99,96%" or "1.252" or "1,252"
    const cleaned = value.replace(/%/g, '').replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(cleaned);
  }
  return 0;
}

// ==================== MAIN IMPORT ====================

async function main() {
  console.log('🚀 Import từ Template v2');
  console.log(`📄 File: ${TEMPLATE_FILE}`);
  console.log(`🔗 Database: Railway PostgreSQL`);

  try {
    // Read Excel
    const workbook = XLSX.readFile(TEMPLATE_FILE);
    console.log(`📊 Sheets: ${workbook.SheetNames.join(', ')}`);

    // ==================== 1. DEPARTMENTS ====================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📁 1. IMPORT DEPARTMENTS');
    console.log('═══════════════════════════════════════════════════════════');

    const deptSheet = workbook.Sheets['1. Departments'];
    const deptData = XLSX.utils.sheet_to_json(deptSheet, { header: 1 }) as any[][];

    const departmentMap = new Map<string, string>(); // normalized name -> id

    for (let i = 3; i < deptData.length; i++) {
      const row = deptData[i];
      if (!row || !row[1]) continue;

      const name = String(row[1]).trim();
      const description = row[2] ? String(row[2]).trim() : null;

      const dept = await prisma.department.create({
        data: { name, description },
      });

      departmentMap.set(normalizeDepName(name), dept.id);
      console.log(`  ✓ ${name}`);
    }
    console.log(`  → Tổng: ${departmentMap.size} phòng ban`);

    // ==================== 2. USER ====================
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'admin@umc.edu.vn',
          passwordHash: '$2b$10$placeholder',
          name: 'Admin',
        },
      });
      console.log('\n✓ Created admin user');
    }

    // ==================== 3. MASTER TASKS + WEEK TASK PROGRESS ====================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 2. IMPORT MASTER TASKS & WEEK PROGRESS');
    console.log('═══════════════════════════════════════════════════════════');

    const taskSheet = workbook.Sheets['2. MasterTask'];
    const taskData = XLSX.utils.sheet_to_json(taskSheet, { header: 1 }) as any[][];

    // Header: Phòng/Ban, Nhiệm vụ, Nội dung báo cáo, Tuần, Loại nhiệm vụ, Tiến độ
    const masterTaskMap = new Map<string, string>(); // "deptId|taskName" -> masterTaskId
    const weekMap = new Map<number, string>(); // weekNumber -> weekId

    let taskCount = 0;
    let progressCount = 0;

    for (let i = 1; i < taskData.length; i++) {
      const row = taskData[i];
      if (!row || !row[0] || !row[1]) continue;

      const deptName = String(row[0]).trim();
      const taskName = String(row[1]).trim();
      const result = row[2] ? String(row[2]).trim() : '';
      const weekNumber = row[3] ? parseInt(String(row[3])) : 1;
      const taskType = row[4] ? String(row[4]).trim() : 'Regular';
      const progress = row[5] ? parseNumber(row[5]) : null;

      // Find department
      const normalizedDept = normalizeDepName(deptName);
      let deptId = departmentMap.get(normalizedDept);

      // Try partial match if exact match fails
      if (!deptId) {
        for (const [key, id] of departmentMap) {
          if (key.includes(normalizedDept) || normalizedDept.includes(key)) {
            deptId = id;
            break;
          }
        }
      }

      if (!deptId) {
        console.log(`  ⚠️ Không tìm thấy phòng: ${deptName}`);
        continue;
      }

      // Create or get MasterTask
      const taskKey = `${deptId}|${taskName}`;
      let masterTaskId = masterTaskMap.get(taskKey);

      if (!masterTaskId) {
        const masterTask = await prisma.masterTask.create({
          data: {
            departmentId: deptId,
            name: taskName,
          },
        });
        masterTaskId = masterTask.id;
        masterTaskMap.set(taskKey, masterTaskId);
        taskCount++;
      }

      // Create or get Week
      if (!weekMap.has(weekNumber)) {
        const { startDate, endDate } = getWeekDates(weekNumber, YEAR);
        const week = await prisma.week.create({
          data: {
            weekNumber,
            year: YEAR,
            startDate,
            endDate,
            status: 'COMPLETED',
            createdById: user.id,
          },
        });
        weekMap.set(weekNumber, week.id);
        console.log(`  📅 Tạo tuần ${weekNumber}`);
      }

      const weekId = weekMap.get(weekNumber)!;

      // Create WeekTaskProgress
      try {
        await prisma.weekTaskProgress.create({
          data: {
            masterTaskId,
            weekId,
            orderNumber: i,
            result,
            timePeriod: '',
            progress: progress !== null ? Math.round(progress * 100) : null,
            nextWeekPlan: '',
            isImportant: taskType === 'Important',
          },
        });
        progressCount++;
      } catch (e: any) {
        if (e.code !== 'P2002') { // Ignore unique constraint
          console.log(`  ❌ Lỗi task progress: ${e.message}`);
        }
      }
    }

    console.log(`  → Tổng: ${taskCount} nhiệm vụ, ${progressCount} báo cáo tuần`);

    // ==================== 4. METRIC DEFINITIONS + WEEK METRIC VALUES ====================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 3. IMPORT METRICS & DATA');
    console.log('═══════════════════════════════════════════════════════════');

    const dataSheet = workbook.Sheets['3. Data'];
    const dataRows = XLSX.utils.sheet_to_json(dataSheet, { header: 1 }) as any[][];

    // Header: Đơn vị, Tên chỉ số, Số liệu, Đơn vị, Tuần, Ghi chú
    const metricDefMap = new Map<string, string>(); // "deptId|metricName" -> metricId

    let metricDefCount = 0;
    let metricValueCount = 0;

    for (let i = 1; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || !row[0] || !row[1]) continue;

      const deptName = String(row[0]).trim();
      const metricName = String(row[1]).trim();
      const value = parseNumber(row[2]);
      const unit = row[3] ? String(row[3]).trim() : null;
      const weekNumber = row[4] ? parseInt(String(row[4])) : 1;
      const note = row[5] ? String(row[5]).trim() : null;

      // Find department
      const normalizedDept = normalizeDepName(deptName);
      let deptId = departmentMap.get(normalizedDept);

      if (!deptId) {
        for (const [key, id] of departmentMap) {
          if (key.includes(normalizedDept) || normalizedDept.includes(key)) {
            deptId = id;
            break;
          }
        }
      }

      if (!deptId) {
        console.log(`  ⚠️ Không tìm thấy phòng: ${deptName}`);
        continue;
      }

      // Create or get MetricDefinition
      const metricKey = `${deptId}|${metricName}`;
      let metricId = metricDefMap.get(metricKey);

      if (!metricId) {
        const metricDef = await prisma.metricDefinition.create({
          data: {
            departmentId: deptId,
            name: metricName,
            unit,
            description: note,
            orderNumber: metricDefCount + 1,
          },
        });
        metricId = metricDef.id;
        metricDefMap.set(metricKey, metricId);
        metricDefCount++;
      }

      // Create or get Week (if not exists)
      if (!weekMap.has(weekNumber)) {
        const { startDate, endDate } = getWeekDates(weekNumber, YEAR);
        const week = await prisma.week.create({
          data: {
            weekNumber,
            year: YEAR,
            startDate,
            endDate,
            status: 'COMPLETED',
            createdById: user.id,
          },
        });
        weekMap.set(weekNumber, week.id);
        console.log(`  📅 Tạo tuần ${weekNumber}`);
      }

      const weekId = weekMap.get(weekNumber)!;

      // Create WeekMetricValue
      try {
        await prisma.weekMetricValue.create({
          data: {
            metricId,
            weekId,
            value,
            note,
          },
        });
        metricValueCount++;
      } catch (e: any) {
        if (e.code !== 'P2002') {
          console.log(`  ❌ Lỗi metric value: ${e.message}`);
        }
      }
    }

    console.log(`  → Tổng: ${metricDefCount} chỉ số, ${metricValueCount} điểm dữ liệu`);

    // ==================== SUMMARY ====================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ IMPORT HOÀN TẤT!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  📁 Departments: ${departmentMap.size}`);
    console.log(`  📅 Weeks: ${weekMap.size}`);
    console.log(`  📋 Master Tasks: ${taskCount}`);
    console.log(`  📝 Week Task Progress: ${progressCount}`);
    console.log(`  📊 Metric Definitions: ${metricDefCount}`);
    console.log(`  📈 Week Metric Values: ${metricValueCount}`);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
