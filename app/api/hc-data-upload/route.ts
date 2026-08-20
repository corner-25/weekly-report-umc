import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Nguồn ghi cho dữ liệu nhập tay, phân biệt với luồng tự động từ OneDrive. */
const MANUAL_SOURCE_ID = 'manual-upload';


interface PhongHcRow {
  'Danh mục': string;
  'Nội dung': string;
  'Năm': number;
  'Tháng': number;
  'Tuần': number;
  'Số liệu': number;
}

/**
 * POST: Nhận file Excel, parse, gộp trùng rồi ghi các dòng mới vào hc_metrics.
 * Accepts multipart form with fields:
 *   - file_2025: Excel file for 2025
 *   - file_2026: Excel file for 2026
 *   - (or) files: multiple Excel files
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const allRows: PhongHcRow[] = [];
    const fileResults: { name: string; rows: number; years: number[] }[] = [];

    // Collect all uploaded files
    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Không có file nào được upload' },
        { status: 400 }
      );
    }

    // Parse each Excel file
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const rows = parseHcExcel(buffer);

      const years = [...new Set(rows.map(r => r['Năm']))].sort();
      fileResults.push({
        name: file.name,
        rows: rows.length,
        years,
      });

      allRows.push(...rows);
    }

    if (allRows.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy dữ liệu hợp lệ trong file Excel' },
        { status: 400 }
      );
    }

    // Deduplicate: same (Danh mục, Nội dung, Năm, Tháng, Tuần) → keep latest
    const deduped = deduplicateRows(allRows);

    // Sort by Năm, Tháng, Tuần
    deduped.sort((a, b) => {
      if (a['Năm'] !== b['Năm']) return a['Năm'] - b['Năm'];
      if (a['Tháng'] !== b['Tháng']) return a['Tháng'] - b['Tháng'];
      return a['Tuần'] - b['Tuần'];
    });

    const columns = ['Danh mục', 'Nội dung', 'Năm', 'Tháng', 'Tuần', 'Số liệu'];
    const years = [...new Set(deduped.map(r => r['Năm']))].sort();
    const latestWeek = deduped.reduce((max, r) => {
      if (r['Năm'] > max.year || (r['Năm'] === max.year && r['Tuần'] > max.week)) {
        return { year: r['Năm'], week: r['Tuần'] };
      }
      return max;
    }, { year: 0, week: 0 });

    // Ghi thẳng vào hc_metrics. Trước đây đẩy JSON lên GitHub, nhưng dashboard
    // giờ đọc từ Postgres nên GitHub không còn là kho dữ liệu.
    //
    // Giữ đúng quy tắc của luồng tự động: CHỈ THÊM dòng mới, không ghi đè số
    // đã lưu. Người dùng cần biết dòng nào bị bỏ qua để khỏi tưởng đã cập nhật.
    const existing = await prisma.hcMetric.findMany({
      where: { year: { in: years } },
      select: { category: true, content: true, year: true, week: true },
    });
    const seen = new Set(
      existing.map((r) => `${r.category}|${r.content}|${r.year}|${r.week}`),
    );

    const fresh = deduped.filter(
      (r) => !seen.has(`${r['Danh mục']}|${r['Nội dung']}|${r['Năm']}|${r['Tuần']}`),
    );

    let inserted = 0;
    for (let i = 0; i < fresh.length; i += 200) {
      const { count } = await prisma.hcMetric.createMany({
        data: fresh.slice(i, i + 200).map((r) => ({
          category: r['Danh mục'],
          content: r['Nội dung'],
          year: r['Năm'],
          week: r['Tuần'],
          month: r['Tháng'],
          value: r['Số liệu'],
          sourceId: MANUAL_SOURCE_ID,
        })),
        skipDuplicates: true,
      });
      inserted += count;
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: inserted,
        skippedExisting: deduped.length - fresh.length,
        years,
        latestWeek: `Tuần ${latestWeek.week}/${latestWeek.year}`,
        filesProcessed: fileResults,
        categories: [...new Set(deduped.map(r => r['Danh mục']))].length,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('HC data upload error:', error);
    return NextResponse.json(
      { error: `Lỗi xử lý: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}

// ==================== EXCEL PARSING ====================

function parseHcExcel(buffer: ArrayBuffer): PhongHcRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const rows: PhongHcRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    for (const raw of rawRows) {
      // Try to find the correct columns (handle variations)
      const danhMuc = String(raw['Danh mục'] ?? raw['danh_muc'] ?? raw['DanhMuc'] ?? '').trim();
      const noiDung = String(raw['Nội dung'] ?? raw['noi_dung'] ?? raw['NoiDung'] ?? '').trim();
      const nam = Number(raw['Năm'] ?? raw['nam'] ?? raw['Nam'] ?? 0);
      const thang = Number(raw['Tháng'] ?? raw['thang'] ?? raw['Thang'] ?? 0);
      const tuan = Number(raw['Tuần'] ?? raw['tuan'] ?? raw['Tuan'] ?? 0);
      const soLieu = Number(raw['Số liệu'] ?? raw['so_lieu'] ?? raw['SoLieu'] ?? 0);

      // Skip invalid rows
      if (!danhMuc || !noiDung || !nam || !thang || !tuan) continue;

      rows.push({
        'Danh mục': danhMuc,
        'Nội dung': noiDung,
        'Năm': nam,
        'Tháng': thang,
        'Tuần': tuan,
        'Số liệu': isNaN(soLieu) ? 0 : soLieu,
      });
    }
  }

  return rows;
}

// ==================== DEDUPLICATION ====================

function deduplicateRows(rows: PhongHcRow[]): PhongHcRow[] {
  const map = new Map<string, PhongHcRow>();
  for (const row of rows) {
    const key = `${row['Danh mục']}||${row['Nội dung']}||${row['Năm']}||${row['Tháng']}||${row['Tuần']}`;
    map.set(key, row); // later entry overwrites earlier
  }
  return Array.from(map.values());
}
