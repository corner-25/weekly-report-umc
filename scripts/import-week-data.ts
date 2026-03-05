/**
 * Script import dữ liệu tuần từ Excel 2026 vào database Railway
 * Import: Weeks + WeekMetricValue (giá trị số liệu theo tuần)
 *
 * Chạy: npx tsx scripts/import-week-data.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

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

const EXCEL_FILE = '/Users/quang/Downloads/2026_Bao cao tuan Benh vien.xlsx';
const YEAR = 2026;

// ==================== METRIC PATTERNS ====================
// Map các pattern trong Excel với metric definitions đã tạo

interface MetricPattern {
  pattern: RegExp;
  metricName: string;
  department: string;
}

const METRIC_PATTERNS: MetricPattern[] = [
  // PHÒNG KẾ HOẠCH TỔNG HỢP
  { pattern: /Ghép thận.*?(\d+)\s*ca/i, metricName: 'Số ca ghép thận', department: 'PHÒNG KẾ HOẠCH TỔNG HỢP' },
  { pattern: /Ghép tim.*?(\d+)\s*ca/i, metricName: 'Số ca ghép tim', department: 'PHÒNG KẾ HOẠCH TỔNG HỢP' },
  { pattern: /Ghép gan.*?(\d+)\s*ca/i, metricName: 'Số ca ghép gan', department: 'PHÒNG KẾ HOẠCH TỔNG HỢP' },
  { pattern: /(\d+(?:[.,]\d+)?)\s*HSBA.*?kiểm tra/i, metricName: 'Số HSBA kiểm tra tiếp nhận', department: 'PHÒNG KẾ HOẠCH TỔNG HỢP' },
  { pattern: /(\d+(?:[.,]\d+)?)\s*HSBA.*?in mã/i, metricName: 'Số HSBA in mã lưu trữ', department: 'PHÒNG KẾ HOẠCH TỔNG HỢP' },
  { pattern: /Văn bản đến.*?(\d+)\s*văn bản/i, metricName: 'Số văn bản đến ngoại viện', department: 'PHÒNG KẾ HOẠCH TỔNG HỢP' },
  { pattern: /Văn bản đi.*?(\d+)\s*văn bản/i, metricName: 'Số văn bản đi ngoại viện', department: 'PHÒNG KẾ HOẠCH TỔNG HỢP' },
  { pattern: /Văn bản nội bộ.*?(\d+)\s*văn bản/i, metricName: 'Số văn bản nội bộ', department: 'PHÒNG KẾ HOẠCH TỔNG HỢP' },

  // PHÒNG ĐIỀU DƯỠNG
  { pattern: /(\d+)\s*lượt.*?kiểm tra/i, metricName: 'Số lượt kiểm tra an toàn', department: 'PHÒNG ĐIỀU DƯỠNG' },
  { pattern: /(\d+)\s*hồ sơ.*?xử lý/i, metricName: 'Số phản ánh xử lý', department: 'PHÒNG ĐIỀU DƯỠNG' },

  // PHÒNG KHOA HỌC VÀ ĐÀO TẠO
  { pattern: /Đào tạo.*?(\d+(?:[.,]\d+)?)\s*người/i, metricName: 'Số học viên đào tạo liên tục', department: 'PHÒNG KHOA HỌC VÀ ĐÀO TẠO' },
  { pattern: /(\d+)\s*đề tài.*?nghiệm thu/i, metricName: 'Số đề tài NCKH cấp cơ sở nghiệm thu', department: 'PHÒNG KHOA HỌC VÀ ĐÀO TẠO' },
  { pattern: /(\d+)\s*đề tài.*?đang thực hiện/i, metricName: 'Số đề tài NCKH đang thực hiện', department: 'PHÒNG KHOA HỌC VÀ ĐÀO TẠO' },
  { pattern: /Hợp tác quốc tế.*?(\d+)\s*lượt/i, metricName: 'Số lượt đoàn quốc tế đón tiếp', department: 'PHÒNG KHOA HỌC VÀ ĐÀO TẠO' },

  // PHÒNG HÀNH CHÍNH
  { pattern: /(\d+)\s*văn bản.*?đến/i, metricName: 'Số văn bản đến tiếp nhận', department: 'PHÒNG HÀNH CHÍNH' },
  { pattern: /(\d+)\s*văn bản.*?đi/i, metricName: 'Số văn bản đi phát hành', department: 'PHÒNG HÀNH CHÍNH' },
  { pattern: /tiếp đón.*?(\d+)\s*lượt/i, metricName: 'Số lượt tiếp đón khách VIP', department: 'PHÒNG HÀNH CHÍNH' },
  { pattern: /Tổng đài.*?(\d+)\s*cuộc/i, metricName: 'Số cuộc gọi tổng đài tiếp nhận', department: 'PHÒNG HÀNH CHÍNH' },
  { pattern: /(\d+)\s*cuộc.*?tiếp nhận/i, metricName: 'Số cuộc gọi tổng đài tiếp nhận', department: 'PHÒNG HÀNH CHÍNH' },

  // PHÒNG TỔ CHỨC CÁN BỘ
  { pattern: /(\d+)\s*hồ sơ.*?tuyển dụng/i, metricName: 'Số hồ sơ tuyển dụng tiếp nhận', department: 'PHÒNG TỔ CHỨC CÁN BỘ' },
  { pattern: /(\d+)\s*hồ sơ.*?nghỉ việc/i, metricName: 'Số CBVC nghỉ việc trong tuần', department: 'PHÒNG TỔ CHỨC CÁN BỘ' },

  // PHÒNG CÔNG NGHỆ THÔNG TIN
  { pattern: /Hỗ trợ.*?(\d+)\s*lượt/i, metricName: 'Số yêu cầu hỗ trợ tiếp nhận', department: 'PHÒNG CÔNG NGHỆ THÔNG TIN' },
  { pattern: /(\d+)\s*lượt.*?hỗ trợ/i, metricName: 'Số yêu cầu hỗ trợ tiếp nhận', department: 'PHÒNG CÔNG NGHỆ THÔNG TIN' },
  { pattern: /(\d+)\s*ticket/i, metricName: 'Số yêu cầu hỗ trợ tiếp nhận', department: 'PHÒNG CÔNG NGHỆ THÔNG TIN' },

  // PHÒNG BẢO HIỂM Y TẾ
  { pattern: /(\d+(?:[.,]\d+)?)\s*lượt.*?BHYT/i, metricName: 'Số lượt KCB BHYT', department: 'PHÒNG BẢO HIỂM Y TẾ' },
  { pattern: /Bảo hiểm thương mại.*?(\d+)\s*lượt/i, metricName: 'Số lượt bảo lãnh BHTN', department: 'PHÒNG BẢO HIỂM Y TẾ' },

  // TRUNG TÂM TRUYỀN THÔNG
  { pattern: /(\d+)\s*bài/i, metricName: 'Số bài viết website', department: 'TRUNG TÂM TRUYỀN THÔNG' },
  { pattern: /(\d+(?:[.,]\d+)?)\s*lượt.*?tương tác/i, metricName: 'Số lượt tương tác Facebook', department: 'TRUNG TÂM TRUYỀN THÔNG' },
  { pattern: /(\d+(?:[.,]\d+)?)\s*lượt.*?tiếp cận/i, metricName: 'Số lượt tiếp cận Facebook', department: 'TRUNG TÂM TRUYỀN THÔNG' },

  // ĐƠN VỊ QUẢN LÝ ĐẤU THẦU
  { pattern: /(\d+)\s*hồ sơ.*?đấu thầu/i, metricName: 'Số gói thầu đang thực hiện', department: 'ĐƠN VỊ QUẢN LÝ ĐẤU THẦU' },
  { pattern: /đấu thầu.*?(\d+)\s*hồ sơ/i, metricName: 'Số gói thầu đang thực hiện', department: 'ĐƠN VỊ QUẢN LÝ ĐẤU THẦU' },
];

// ==================== HELPER FUNCTIONS ====================

function parseWeekNumber(sheetName: string): number {
  // "01.2026" -> 1, "02.2026" -> 2
  const match = sheetName.match(/^(\d+)\./);
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

function parseNumber(str: string): number {
  // "1.252" -> 1252, "1,252" -> 1252
  const cleaned = str.replace(/[.,]/g, '');
  return parseInt(cleaned, 10);
}

// ==================== EXTRACT METRICS ====================

interface ExtractedMetric {
  department: string;
  metricName: string;
  value: number;
  rawText: string;
}

function extractMetricsFromSheet(worksheet: XLSX.WorkSheet): ExtractedMetric[] {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  const metrics: ExtractedMetric[] = [];

  let currentDepartment = '';

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const col0 = row[0] ? String(row[0]).trim() : '';
    const col1 = row[1] ? String(row[1]).trim() : '';
    const col2 = row[2] ? String(row[2]).trim() : '';

    // Detect department header
    if (col0.startsWith('PHÒNG') || col0.startsWith('TRUNG TÂM') || col0.startsWith('ĐƠN VỊ')) {
      currentDepartment = col0;
      continue;
    }

    if (!currentDepartment) continue;

    // Combine task name and result for pattern matching
    const fullText = `${col1} ${col2}`;

    // Try to match patterns
    for (const pattern of METRIC_PATTERNS) {
      // Only match if department matches or pattern explicitly specifies department
      const match = fullText.match(pattern.pattern);
      if (match && match[1]) {
        const value = parseNumber(match[1]);
        if (!isNaN(value) && value >= 0) {
          metrics.push({
            department: pattern.department,
            metricName: pattern.metricName,
            value,
            rawText: match[0],
          });
        }
      }
    }

    // Also try direct number extraction from specific columns
    // Pattern: "Số liệu: X ca/lượt/người"
    const directMatches = col2.matchAll(/(\d+(?:[.,]\d+)?)\s*(ca|lượt|người|bài|đề tài|HSBA|cuộc|văn bản|hồ sơ|ticket|yêu cầu)/gi);
    for (const match of directMatches) {
      const value = parseNumber(match[1]);
      const unit = match[2].toLowerCase();

      // Map unit to possible metric
      let metricName = '';
      if (unit === 'ca' && col1.toLowerCase().includes('ghép')) {
        if (col1.toLowerCase().includes('thận')) metricName = 'Số ca ghép thận';
        else if (col1.toLowerCase().includes('tim')) metricName = 'Số ca ghép tim';
        else if (col1.toLowerCase().includes('gan')) metricName = 'Số ca ghép gan';
      }

      if (metricName && !metrics.some(m => m.metricName === metricName)) {
        metrics.push({
          department: currentDepartment,
          metricName,
          value,
          rawText: match[0],
        });
      }
    }
  }

  return metrics;
}

// ==================== MAIN IMPORT ====================

// Find best matching metric by partial name match
function findMatchingMetric(
  metricName: string,
  departmentId: string,
  metricMap: Map<string, string>,
  allMetrics: { id: string; name: string; departmentId: string }[]
): string | null {
  // Try exact match first
  const exactKey = `${departmentId}|${metricName}`;
  if (metricMap.has(exactKey)) {
    return metricMap.get(exactKey)!;
  }

  // Try partial match - find metrics in same department that contain similar keywords
  const keywords = metricName.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  const deptMetrics = allMetrics.filter(m => m.departmentId === departmentId);

  for (const metric of deptMetrics) {
    const metricLower = metric.name.toLowerCase();
    const matchCount = keywords.filter(k => metricLower.includes(k)).length;
    if (matchCount >= Math.ceil(keywords.length / 2)) {
      return metric.id;
    }
  }

  return null;
}

async function main() {
  console.log('🚀 Starting Week Data Import to Railway...');
  console.log(`📄 File: ${EXCEL_FILE}`);
  console.log(`🔗 Database: Railway PostgreSQL`);
  console.log(`📅 Year: ${YEAR}`);

  try {
    // Read Excel file
    console.log('\n📖 Reading Excel file...');
    const workbook = XLSX.readFile(EXCEL_FILE);
    console.log(`  Sheets: ${workbook.SheetNames.join(', ')}`);

    // Get existing data from database
    console.log('\n📊 Fetching existing data from database...');

    const departments = await prisma.department.findMany();
    const departmentMap = new Map(departments.map(d => [d.name, d.id]));
    console.log(`  - Departments: ${departmentMap.size}`);

    const metricDefs = await prisma.metricDefinition.findMany({
      include: { department: true },
    });
    const metricMap = new Map<string, string>(); // "deptId|metricName" -> metricId
    const allMetrics: { id: string; name: string; departmentId: string }[] = [];
    for (const m of metricDefs) {
      metricMap.set(`${m.departmentId}|${m.name}`, m.id);
      allMetrics.push({ id: m.id, name: m.name, departmentId: m.departmentId });
    }
    console.log(`  - Metric Definitions: ${metricMap.size}`);

    // Get or create user
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'admin@umc.edu.vn',
          passwordHash: '$2b$10$placeholder',
          name: 'Admin',
        },
      });
      console.log('  - Created admin user');
    }

    // Process each sheet (week)
    console.log('\n📅 Processing weeks...');

    let totalMetricValues = 0;

    for (const sheetName of workbook.SheetNames) {
      const weekNumber = parseWeekNumber(sheetName);
      if (weekNumber === 0) {
        console.log(`  ⚠️ Skipping sheet: ${sheetName} (invalid week number)`);
        continue;
      }

      const { startDate, endDate } = getWeekDates(weekNumber, YEAR);

      // Create or get week
      const week = await prisma.week.upsert({
        where: {
          weekNumber_year: { weekNumber, year: YEAR },
        },
        update: {},
        create: {
          weekNumber,
          year: YEAR,
          startDate,
          endDate,
          status: 'COMPLETED',
          createdById: user.id,
        },
      });

      console.log(`\n  📋 Week ${weekNumber} (${sheetName}):`);

      // Extract metrics from sheet
      const worksheet = workbook.Sheets[sheetName];
      const extractedMetrics = extractMetricsFromSheet(worksheet);

      console.log(`     Found ${extractedMetrics.length} metric values`);

      // Insert metric values
      let weekMetricCount = 0;
      for (const metric of extractedMetrics) {
        const deptId = departmentMap.get(metric.department);
        if (!deptId) {
          // Try partial match
          const matchedDept = Array.from(departmentMap.entries()).find(([name]) =>
            name.includes(metric.department) || metric.department.includes(name)
          );
          if (!matchedDept) {
            console.log(`     ⚠️ Department not found: ${metric.department}`);
            continue;
          }
        }

        const actualDeptId = deptId || departmentMap.get(metric.department);
        if (!actualDeptId) continue;

        const actualMetricId = findMatchingMetric(metric.metricName, actualDeptId, metricMap, allMetrics);
        if (!actualMetricId) {
          console.log(`     ⚠️ Metric not found: ${metric.metricName} (${metric.department})`);
          continue;
        }

        try {
          await prisma.weekMetricValue.upsert({
            where: {
              metricId_weekId: {
                metricId: actualMetricId,
                weekId: week.id,
              },
            },
            update: {
              value: metric.value,
            },
            create: {
              metricId: actualMetricId,
              weekId: week.id,
              value: metric.value,
            },
          });
          weekMetricCount++;
        } catch (e: any) {
          console.log(`     ❌ Error inserting ${metric.metricName}: ${e.message}`);
        }
      }

      console.log(`     ✅ Inserted ${weekMetricCount} metric values`);
      totalMetricValues += weekMetricCount;
    }

    // Summary
    console.log('\n✅ Import completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Weeks processed: ${workbook.SheetNames.length}`);
    console.log(`  - Total metric values: ${totalMetricValues}`);

    // Verify
    const weekCount = await prisma.week.count({ where: { year: YEAR } });
    const metricValueCount = await prisma.weekMetricValue.count();
    console.log(`\n📈 Database verification:`);
    console.log(`  - Weeks in ${YEAR}: ${weekCount}`);
    console.log(`  - Total WeekMetricValues: ${metricValueCount}`);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
