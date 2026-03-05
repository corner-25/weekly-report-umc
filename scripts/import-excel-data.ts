/**
 * Script import dữ liệu từ Excel vào database Railway
 *
 * Chạy: npx tsx scripts/import-excel-data.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

// Railway Database URL
const DATABASE_URL = 'postgresql://postgres:YYEGqWdLqchHITKHhtQFwrwSHMBeYYBE@caboose.proxy.rlwy.net:46621/railway';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
  log: ['warn', 'error'],
});

// Batch size for bulk operations
const BATCH_SIZE = 50;

// ==================== CONFIGURATION ====================

const EXCEL_FILE_PATH = path.join(__dirname, '../data-push-railway/data_push_railway.xlsx');

const DEPARTMENTS = [
  'PHÒNG KẾ HOẠCH TỔNG HỢP',
  'PHÒNG ĐIỀU DƯỠNG',
  'PHÒNG KHOA HỌC VÀ ĐÀO TẠO',
  'PHÒNG QUẢN LÝ CHẤT LƯỢNG BỆNH VIỆN',
  'PHÒNG HÀNH CHÍNH',
  'PHÒNG TỔ CHỨC CÁN BỘ',
  'PHÒNG VẬT TƯ THIẾT BỊ',
  'PHÒNG CÔNG NGHỆ THÔNG TIN',
  'PHÒNG CÔNG TÁC XÃ HỘI',
  'PHÒNG QUẢN TRỊ TÒA NHÀ',
  'PHÒNG TÀI CHÍNH KẾ TOÁN',
  'PHÒNG BẢO HIỂM Y TẾ',
];

const YEAR = 2025;

// ==================== TYPES ====================

interface ParsedTask {
  departmentName: string;
  taskName: string;
  result: string;
  timePeriod: string;
  progress: number | null;
  orderNumber: number;
}

interface ParsedMetric {
  departmentName: string;
  metricName: string;
  value: number;
  unit: string;
  note: string;
}

interface WeekData {
  weekNumber: number;
  sheetName: string;
  tasks: ParsedTask[];
  metrics: ParsedMetric[];
}

// ==================== HELPER FUNCTIONS ====================

function parseWeekNumber(sheetName: string): number {
  // "Tuan 01" -> 1, "Tuan 05 (nghi Tet AL)" -> 5
  const match = sheetName.match(/Tuan\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

function getWeekDates(weekNumber: number, year: number): { startDate: Date; endDate: Date } {
  // Tính ngày đầu tuần và cuối tuần theo ISO week
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

function extractMetricsFromResult(result: string, departmentName: string): ParsedMetric[] {
  const metrics: ParsedMetric[] = [];

  // Pattern 1: "Tên chỉ số: 123 đơn vị" hoặc "- Tên chỉ số: 123"
  const pattern1 = /[-•]?\s*([^:\n]{5,50}):\s*(\d+(?:[,\.]\d+)?)\s*([^\n,;]{0,20})/g;

  let match;
  while ((match = pattern1.exec(result)) !== null) {
    const metricName = match[1].trim();
    const valueStr = match[2].replace(',', '.');
    const unit = match[3].trim();

    // Lọc bỏ các pattern không phải metric
    if (
      !metricName.match(/ngày|tháng|năm|QĐ|CV|lần \d|đợt|giai đoạn|bước/i) &&
      metricName.length > 5 &&
      metricName.length < 50
    ) {
      const value = parseFloat(valueStr);
      if (!isNaN(value) && value < 100000) { // Giới hạn giá trị hợp lý
        metrics.push({
          departmentName,
          metricName,
          value,
          unit: unit.replace(/^(ca|lượt|người|bài|đề tài|chương trình|hồ sơ|HSBA|cuộc|văn bản).*$/i, '$1'),
          note: '',
        });
      }
    }
  }

  // Pattern 2: "Số lượng xxx: 123"
  const pattern2 = /Số\s+(lượng\s+)?([^:\n]{3,40}):\s*(\d+(?:[,\.]\d+)?)/gi;
  while ((match = pattern2.exec(result)) !== null) {
    const metricName = `Số ${match[2].trim()}`;
    const valueStr = match[3].replace(',', '.');
    const value = parseFloat(valueStr);

    if (!isNaN(value) && value < 100000) {
      // Check duplicate
      if (!metrics.some(m => m.metricName === metricName)) {
        metrics.push({
          departmentName,
          metricName,
          value,
          unit: '',
          note: '',
        });
      }
    }
  }

  return metrics;
}

function parseProgress(progressCell: any): number | null {
  if (progressCell === null || progressCell === undefined || progressCell === '') {
    return null;
  }

  const value = parseFloat(String(progressCell).replace('%', '').replace(',', '.'));

  if (isNaN(value)) return null;

  // Nếu giá trị <= 1, có thể là dạng 0.8 = 80%
  if (value <= 1 && value > 0) {
    return Math.round(value * 100);
  }

  return Math.round(value);
}

// ==================== PARSING FUNCTIONS ====================

function parseSheet(worksheet: XLSX.WorkSheet, sheetName: string): WeekData {
  const weekNumber = parseWeekNumber(sheetName);
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  const tasks: ParsedTask[] = [];
  const metrics: ParsedMetric[] = [];

  let currentDepartment = '';
  let orderNumber = 0;

  for (let i = 5; i < data.length; i++) { // Skip header rows
    const row = data[i];
    if (!row || row.length === 0) continue;

    const col0 = row[0] ? String(row[0]).trim() : '';
    const col1 = row[1] ? String(row[1]).trim() : '';
    const col2 = row[2] ? String(row[2]).trim() : '';
    const col3 = row[3] ? String(row[3]).trim() : '';
    const col4 = row[4];

    // Check if this is a department header
    if (DEPARTMENTS.includes(col0)) {
      currentDepartment = col0;
      orderNumber = 0;
      continue;
    }

    // Skip if no department context
    if (!currentDepartment) continue;

    // Skip empty rows or rows without task name
    if (!col1 && !col2) continue;

    // Parse task
    const taskName = col1 || '';
    const result = col2 || '';
    const timePeriod = col3 || '';
    const progress = parseProgress(col4);

    // Only add if there's meaningful content
    if (taskName && taskName.length > 3) {
      orderNumber++;
      tasks.push({
        departmentName: currentDepartment,
        taskName,
        result,
        timePeriod,
        progress,
        orderNumber,
      });

      // Extract metrics from result
      if (result) {
        const extractedMetrics = extractMetricsFromResult(result, currentDepartment);
        metrics.push(...extractedMetrics);
      }
    }
  }

  return {
    weekNumber,
    sheetName,
    tasks,
    metrics,
  };
}

// ==================== DATABASE FUNCTIONS ====================

async function createDepartments(): Promise<Map<string, string>> {
  console.log('\n📁 Creating Departments...');
  const departmentMap = new Map<string, string>();

  for (const name of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    departmentMap.set(name, dept.id);
    console.log(`  ✓ ${name}`);
  }

  return departmentMap;
}

async function createWeeks(weekDataList: WeekData[], userId: string): Promise<Map<number, string>> {
  console.log('\n📅 Creating Weeks...');
  const weekMap = new Map<number, string>();

  for (const weekData of weekDataList) {
    const { startDate, endDate } = getWeekDates(weekData.weekNumber, YEAR);

    const week = await prisma.week.upsert({
      where: {
        weekNumber_year: {
          weekNumber: weekData.weekNumber,
          year: YEAR,
        },
      },
      update: {},
      create: {
        weekNumber: weekData.weekNumber,
        year: YEAR,
        startDate,
        endDate,
        status: 'COMPLETED',
        createdById: userId,
      },
    });

    weekMap.set(weekData.weekNumber, week.id);
    console.log(`  ✓ Tuần ${weekData.weekNumber} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`);
  }

  return weekMap;
}

async function createMasterTasks(
  weekDataList: WeekData[],
  departmentMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log('\n📋 Creating Master Tasks...');
  const masterTaskMap = new Map<string, string>(); // key: "deptId|taskName"

  // Collect unique tasks per department
  const uniqueTasks = new Map<string, Set<string>>();

  for (const weekData of weekDataList) {
    for (const task of weekData.tasks) {
      const deptId = departmentMap.get(task.departmentName);
      if (!deptId) continue;

      if (!uniqueTasks.has(deptId)) {
        uniqueTasks.set(deptId, new Set());
      }
      uniqueTasks.get(deptId)!.add(task.taskName);
    }
  }

  // Create master tasks using batch creates
  for (const [deptId, taskNames] of uniqueTasks) {
    const taskNameArray = Array.from(taskNames);
    console.log(`  Department: ${taskNameArray.length} tasks`);

    // Create in batches
    for (let i = 0; i < taskNameArray.length; i += BATCH_SIZE) {
      const batch = taskNameArray.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(
        batch.map(taskName =>
          prisma.masterTask.create({
            data: {
              departmentId: deptId,
              name: taskName,
            },
          })
        )
      );
    }

    // Fetch all created tasks for this department
    const createdTasks = await prisma.masterTask.findMany({
      where: { departmentId: deptId },
    });

    for (const task of createdTasks) {
      const key = `${deptId}|${task.name}`;
      masterTaskMap.set(key, task.id);
    }
  }

  console.log(`  ✓ Total: ${masterTaskMap.size} master tasks`);
  return masterTaskMap;
}

async function createMetricDefinitions(
  weekDataList: WeekData[],
  departmentMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log('\n📊 Creating Metric Definitions...');
  const metricMap = new Map<string, string>(); // key: "deptId|metricName"

  // Collect unique metrics per department
  const uniqueMetrics = new Map<string, Map<string, string>>(); // deptId -> metricName -> unit

  for (const weekData of weekDataList) {
    for (const metric of weekData.metrics) {
      const deptId = departmentMap.get(metric.departmentName);
      if (!deptId) continue;

      if (!uniqueMetrics.has(deptId)) {
        uniqueMetrics.set(deptId, new Map());
      }

      // Keep first unit found
      if (!uniqueMetrics.get(deptId)!.has(metric.metricName)) {
        uniqueMetrics.get(deptId)!.set(metric.metricName, metric.unit);
      }
    }
  }

  // Create metric definitions using batch creates
  let globalOrderNumber = 0;
  for (const [deptId, metricsMap] of uniqueMetrics) {
    const metricsArray = Array.from(metricsMap.entries());
    console.log(`  Department: ${metricsArray.length} metrics`);

    // Create in batches
    for (let i = 0; i < metricsArray.length; i += BATCH_SIZE) {
      const batch = metricsArray.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(
        batch.map(([metricName, unit]) => {
          globalOrderNumber++;
          return prisma.metricDefinition.create({
            data: {
              departmentId: deptId,
              name: metricName,
              unit: unit || null,
              orderNumber: globalOrderNumber,
            },
          });
        })
      );
    }

    // Fetch all created metrics for this department
    const createdMetrics = await prisma.metricDefinition.findMany({
      where: { departmentId: deptId },
    });

    for (const metric of createdMetrics) {
      const key = `${deptId}|${metric.name}`;
      metricMap.set(key, metric.id);
    }
  }

  console.log(`  ✓ Total: ${metricMap.size} metric definitions`);
  return metricMap;
}

async function importWeekTaskProgress(
  weekDataList: WeekData[],
  weekMap: Map<number, string>,
  masterTaskMap: Map<string, string>,
  departmentMap: Map<string, string>
): Promise<void> {
  console.log('\n📝 Importing Week Task Progress...');

  let totalCreated = 0;

  for (const weekData of weekDataList) {
    const weekId = weekMap.get(weekData.weekNumber);
    if (!weekId) continue;

    // Prepare all task progress data for this week
    const taskProgressData: any[] = [];

    for (const task of weekData.tasks) {
      const deptId = departmentMap.get(task.departmentName);
      if (!deptId) continue;

      const masterTaskKey = `${deptId}|${task.taskName}`;
      const masterTaskId = masterTaskMap.get(masterTaskKey);
      if (!masterTaskId) continue;

      taskProgressData.push({
        masterTaskId,
        weekId,
        orderNumber: task.orderNumber,
        result: task.result || '',
        timePeriod: task.timePeriod || '',
        progress: task.progress,
        nextWeekPlan: '',
        completedAt: task.progress === 100 ? new Date() : null,
      });
    }

    // Create in batches using transaction
    for (let i = 0; i < taskProgressData.length; i += BATCH_SIZE) {
      const batch = taskProgressData.slice(i, i + BATCH_SIZE);

      try {
        await prisma.$transaction(
          batch.map(data => prisma.weekTaskProgress.create({ data }))
        );
      } catch (e: any) {
        // Skip duplicates
        if (e.code !== 'P2002') throw e;
      }
    }

    totalCreated += taskProgressData.length;
    console.log(`  ✓ Tuần ${weekData.weekNumber}: ${taskProgressData.length} task progress records`);
  }

  console.log(`  ✓ Total: ${totalCreated} week task progress records`);
}

async function importWeekMetricValues(
  weekDataList: WeekData[],
  weekMap: Map<number, string>,
  metricMap: Map<string, string>,
  departmentMap: Map<string, string>
): Promise<void> {
  console.log('\n📈 Importing Week Metric Values...');

  let totalCreated = 0;

  for (const weekData of weekDataList) {
    const weekId = weekMap.get(weekData.weekNumber);
    if (!weekId) continue;

    // Prepare all metric values data for this week
    // Use a Map to avoid duplicates (same metric in same week)
    const metricValuesMap = new Map<string, any>();

    for (const metric of weekData.metrics) {
      const deptId = departmentMap.get(metric.departmentName);
      if (!deptId) continue;

      const metricKey = `${deptId}|${metric.metricName}`;
      const metricId = metricMap.get(metricKey);
      if (!metricId) continue;

      const uniqueKey = `${metricId}|${weekId}`;
      if (!metricValuesMap.has(uniqueKey)) {
        metricValuesMap.set(uniqueKey, {
          metricId,
          weekId,
          value: metric.value,
          note: metric.note || null,
        });
      }
    }

    const metricValuesData = Array.from(metricValuesMap.values());

    // Create in batches using transaction
    for (let i = 0; i < metricValuesData.length; i += BATCH_SIZE) {
      const batch = metricValuesData.slice(i, i + BATCH_SIZE);

      try {
        await prisma.$transaction(
          batch.map(data => prisma.weekMetricValue.create({ data }))
        );
      } catch (e: any) {
        // Skip duplicates
        if (e.code !== 'P2002') throw e;
      }
    }

    totalCreated += metricValuesData.length;
    if (metricValuesData.length > 0) {
      console.log(`  ✓ Tuần ${weekData.weekNumber}: ${metricValuesData.length} metric values`);
    }
  }

  console.log(`  ✓ Total: ${totalCreated} week metric values`);
}

// ==================== CLEAR DATA FUNCTION ====================

async function clearAllData(): Promise<void> {
  console.log('\n🗑️  Clearing old data...');

  // Xoá theo thứ tự để tránh lỗi foreign key
  // 1. Xoá dữ liệu liên quan đến Week trước
  const deletedWeekTaskProgress = await prisma.weekTaskProgress.deleteMany({});
  console.log(`  ✓ Deleted ${deletedWeekTaskProgress.count} week task progress records`);

  const deletedWeekMetricValues = await prisma.weekMetricValue.deleteMany({});
  console.log(`  ✓ Deleted ${deletedWeekMetricValues.count} week metric values`);

  const deletedTasks = await prisma.task.deleteMany({});
  console.log(`  ✓ Deleted ${deletedTasks.count} tasks (deprecated)`);

  // 2. Xoá Weeks
  const deletedWeeks = await prisma.week.deleteMany({});
  console.log(`  ✓ Deleted ${deletedWeeks.count} weeks`);

  // 3. Xoá Master Tasks và Metric Definitions
  const deletedMasterTasks = await prisma.masterTask.deleteMany({});
  console.log(`  ✓ Deleted ${deletedMasterTasks.count} master tasks`);

  const deletedMetricDefinitions = await prisma.metricDefinition.deleteMany({});
  console.log(`  ✓ Deleted ${deletedMetricDefinitions.count} metric definitions`);

  // 4. Xoá Departments (không xoá Secretary liên quan)
  const deletedDepartments = await prisma.department.deleteMany({});
  console.log(`  ✓ Deleted ${deletedDepartments.count} departments`);

  console.log('  ✅ All old data cleared!\n');
}

// ==================== MAIN FUNCTION ====================

async function main() {
  console.log('🚀 Starting Excel Data Import to Railway...');
  console.log(`📄 File: ${EXCEL_FILE_PATH}`);
  console.log(`🔗 Database: Railway PostgreSQL`);

  try {
    // Clear old data first
    await clearAllData();

    // Read Excel file
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    console.log(`📊 Found ${workbook.SheetNames.length} sheets`);

    // Parse all sheets
    const weekDataList: WeekData[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const weekData = parseSheet(worksheet, sheetName);

      if (weekData.weekNumber > 0) {
        weekDataList.push(weekData);
        console.log(`  ✓ ${sheetName}: ${weekData.tasks.length} tasks, ${weekData.metrics.length} metrics`);
      }
    }

    // Sort by week number
    weekDataList.sort((a, b) => a.weekNumber - b.weekNumber);

    // Get or create a default user
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'admin@umc.edu.vn',
          passwordHash: '$2b$10$placeholder', // Placeholder hash
          name: 'Admin',
        },
      });
      console.log('  ✓ Created admin user');
    }

    // Create departments
    const departmentMap = await createDepartments();

    // Create weeks
    const weekMap = await createWeeks(weekDataList, user.id);

    // Create master tasks
    const masterTaskMap = await createMasterTasks(weekDataList, departmentMap);

    // Create metric definitions
    const metricMap = await createMetricDefinitions(weekDataList, departmentMap);

    // Import week task progress
    await importWeekTaskProgress(weekDataList, weekMap, masterTaskMap, departmentMap);

    // Import week metric values
    await importWeekMetricValues(weekDataList, weekMap, metricMap, departmentMap);

    console.log('\n✅ Import completed successfully!');

    // Summary
    console.log('\n📊 Summary:');
    console.log(`  - Departments: ${departmentMap.size}`);
    console.log(`  - Weeks: ${weekMap.size}`);
    console.log(`  - Master Tasks: ${masterTaskMap.size}`);
    console.log(`  - Metric Definitions: ${metricMap.size}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
