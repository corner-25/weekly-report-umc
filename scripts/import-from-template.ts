/**
 * Script import dữ liệu từ Template Excel vào database Railway
 *
 * Chạy: npx tsx scripts/import-from-template.ts
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

const TEMPLATE_FILE = path.join(__dirname, '../data-push-railway/TEMPLATE_import_data_FULL.xlsx');
const BATCH_SIZE = 50;

// ==================== TYPES ====================

interface DepartmentRow {
  stt: number;
  name: string;
  description: string;
}

interface MetricRow {
  stt: number;
  department: string;
  name: string;
  unit: string;
  type: string;
  note: string;
}

interface TaskRow {
  stt: number;
  department: string;
  name: string;
  description: string;
  note: string;
}

// ==================== PARSE FUNCTIONS ====================

function parseDepartments(workbook: XLSX.WorkBook): DepartmentRow[] {
  const sheet = workbook.Sheets['1. Departments'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  const departments: DepartmentRow[] = [];

  // Skip header rows (first 3 rows)
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0] || !row[1]) continue;

    const stt = parseInt(row[0]);
    if (isNaN(stt)) continue;

    departments.push({
      stt,
      name: String(row[1]).trim(),
      description: row[2] ? String(row[2]).trim() : '',
    });
  }

  return departments;
}

function parseMetrics(workbook: XLSX.WorkBook): MetricRow[] {
  const sheet = workbook.Sheets['2. MetricDefinitions'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  const metrics: MetricRow[] = [];

  // Skip header rows (first 3 rows)
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0] || !row[1] || !row[2]) continue;

    const stt = parseInt(row[0]);
    if (isNaN(stt)) continue;

    metrics.push({
      stt,
      department: String(row[1]).trim(),
      name: String(row[2]).trim(),
      unit: row[3] ? String(row[3]).trim() : '',
      type: row[4] ? String(row[4]).trim() : 'TRONG TUẦN',
      note: row[5] ? String(row[5]).trim() : '',
    });
  }

  return metrics;
}

function parseTasks(workbook: XLSX.WorkBook): TaskRow[] {
  const sheet = workbook.Sheets['3. MasterTasks'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  const tasks: TaskRow[] = [];

  // Skip header rows (first 3 rows)
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0] || !row[1] || !row[2]) continue;

    const stt = parseInt(row[0]);
    if (isNaN(stt)) continue;

    tasks.push({
      stt,
      department: String(row[1]).trim(),
      name: String(row[2]).trim(),
      description: row[3] ? String(row[3]).trim() : '',
      note: row[4] ? String(row[4]).trim() : '',
    });
  }

  return tasks;
}

// ==================== IMPORT FUNCTIONS ====================

async function clearAllData(): Promise<void> {
  console.log('\n🗑️  Clearing old data...');

  // Delete in order to avoid FK constraints
  const deletedWeekTaskProgress = await prisma.weekTaskProgress.deleteMany({});
  console.log(`  ✓ Deleted ${deletedWeekTaskProgress.count} week task progress`);

  const deletedWeekMetricValues = await prisma.weekMetricValue.deleteMany({});
  console.log(`  ✓ Deleted ${deletedWeekMetricValues.count} week metric values`);

  const deletedTasks = await prisma.task.deleteMany({});
  console.log(`  ✓ Deleted ${deletedTasks.count} tasks (deprecated)`);

  const deletedWeeks = await prisma.week.deleteMany({});
  console.log(`  ✓ Deleted ${deletedWeeks.count} weeks`);

  const deletedMasterTasks = await prisma.masterTask.deleteMany({});
  console.log(`  ✓ Deleted ${deletedMasterTasks.count} master tasks`);

  const deletedMetricDefinitions = await prisma.metricDefinition.deleteMany({});
  console.log(`  ✓ Deleted ${deletedMetricDefinitions.count} metric definitions`);

  const deletedDepartments = await prisma.department.deleteMany({});
  console.log(`  ✓ Deleted ${deletedDepartments.count} departments`);

  console.log('  ✅ All old data cleared!\n');
}

async function importDepartments(departments: DepartmentRow[]): Promise<Map<string, string>> {
  console.log('\n📁 Importing Departments...');
  const departmentMap = new Map<string, string>();

  for (const dept of departments) {
    const created = await prisma.department.create({
      data: {
        name: dept.name,
        description: dept.description || null,
      },
    });
    departmentMap.set(dept.name, created.id);
    console.log(`  ✓ ${dept.name}`);
  }

  console.log(`  ✅ Total: ${departmentMap.size} departments`);
  return departmentMap;
}

async function importMetrics(
  metrics: MetricRow[],
  departmentMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log('\n📊 Importing Metric Definitions...');
  const metricMap = new Map<string, string>();

  let orderNumber = 0;
  let created = 0;
  let skipped = 0;

  // Group by department for batch processing
  const byDepartment = new Map<string, MetricRow[]>();
  for (const metric of metrics) {
    const deptId = departmentMap.get(metric.department);
    if (!deptId) {
      console.log(`  ⚠️ Skipping metric "${metric.name}" - department not found: ${metric.department}`);
      skipped++;
      continue;
    }

    if (!byDepartment.has(deptId)) {
      byDepartment.set(deptId, []);
    }
    byDepartment.get(deptId)!.push(metric);
  }

  for (const [deptId, deptMetrics] of byDepartment) {
    // Create in batches
    for (let i = 0; i < deptMetrics.length; i += BATCH_SIZE) {
      const batch = deptMetrics.slice(i, i + BATCH_SIZE);

      const results = await prisma.$transaction(
        batch.map(metric => {
          orderNumber++;
          return prisma.metricDefinition.create({
            data: {
              departmentId: deptId,
              name: metric.name,
              unit: metric.unit || null,
              description: metric.note || null,
              orderNumber,
              isActive: true,
            },
          });
        })
      );

      for (let j = 0; j < results.length; j++) {
        const key = `${deptId}|${batch[j].name}`;
        metricMap.set(key, results[j].id);
        created++;
      }
    }
  }

  console.log(`  ✅ Created: ${created}, Skipped: ${skipped}`);
  return metricMap;
}

async function importMasterTasks(
  tasks: TaskRow[],
  departmentMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log('\n📋 Importing Master Tasks...');
  const taskMap = new Map<string, string>();

  let created = 0;
  let skipped = 0;

  // Group by department for batch processing
  const byDepartment = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const deptId = departmentMap.get(task.department);
    if (!deptId) {
      console.log(`  ⚠️ Skipping task "${task.name}" - department not found: ${task.department}`);
      skipped++;
      continue;
    }

    if (!byDepartment.has(deptId)) {
      byDepartment.set(deptId, []);
    }
    byDepartment.get(deptId)!.push(task);
  }

  for (const [deptId, deptTasks] of byDepartment) {
    // Create in batches
    for (let i = 0; i < deptTasks.length; i += BATCH_SIZE) {
      const batch = deptTasks.slice(i, i + BATCH_SIZE);

      const results = await prisma.$transaction(
        batch.map(task =>
          prisma.masterTask.create({
            data: {
              departmentId: deptId,
              name: task.name,
              description: task.description || null,
            },
          })
        )
      );

      for (let j = 0; j < results.length; j++) {
        const key = `${deptId}|${batch[j].name}`;
        taskMap.set(key, results[j].id);
        created++;
      }
    }
  }

  console.log(`  ✅ Created: ${created}, Skipped: ${skipped}`);
  return taskMap;
}

// ==================== MAIN ====================

async function main() {
  console.log('🚀 Starting Template Import to Railway...');
  console.log(`📄 Template: ${TEMPLATE_FILE}`);
  console.log(`🔗 Database: Railway PostgreSQL`);

  try {
    // Read template file
    console.log('\n📖 Reading template file...');
    const workbook = XLSX.readFile(TEMPLATE_FILE);
    console.log(`  Sheets: ${workbook.SheetNames.join(', ')}`);

    // Parse data
    const departments = parseDepartments(workbook);
    const metrics = parseMetrics(workbook);
    const tasks = parseTasks(workbook);

    console.log(`\n📊 Parsed data:`);
    console.log(`  - Departments: ${departments.length}`);
    console.log(`  - Metrics: ${metrics.length}`);
    console.log(`  - Tasks: ${tasks.length}`);

    // Clear old data
    await clearAllData();

    // Import departments
    const departmentMap = await importDepartments(departments);

    // Import metrics
    const metricMap = await importMetrics(metrics, departmentMap);

    // Import master tasks
    const taskMap = await importMasterTasks(tasks, departmentMap);

    // Summary
    console.log('\n✅ Import completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Departments: ${departmentMap.size}`);
    console.log(`  - Metric Definitions: ${metricMap.size}`);
    console.log(`  - Master Tasks: ${taskMap.size}`);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
