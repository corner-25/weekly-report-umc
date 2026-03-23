import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN_PHC;
const GITHUB_OWNER = process.env.GITHUB_OWNER_PHC || 'corner-25';
const GITHUB_REPO = process.env.GITHUB_REPO_PHC || 'dashboard-storage';
const DATA_FILE = 'current_dashboard_data.json';

interface PhongHcRow {
  'Danh mục': string;
  'Nội dung': string;
  'Năm': number;
  'Tháng': number;
  'Tuần': number;
  'Số liệu': number;
}

/**
 * POST: Upload Excel file(s), parse into PhongHcRow[], merge, upload JSON to GitHub
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

  if (!GITHUB_TOKEN) {
    return NextResponse.json(
      { error: 'GitHub token not configured (GITHUB_TOKEN_PHC)' },
      { status: 500 }
    );
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

    // Build GitHub data package
    const columns = ['Danh mục', 'Nội dung', 'Năm', 'Tháng', 'Tuần', 'Số liệu'];
    const years = [...new Set(deduped.map(r => r['Năm']))].sort();
    const latestWeek = deduped.reduce((max, r) => {
      if (r['Năm'] > max.year || (r['Năm'] === max.year && r['Tuần'] > max.week)) {
        return { year: r['Năm'], week: r['Tuần'] };
      }
      return max;
    }, { year: 0, week: 0 });

    const dataPackage = {
      data: deduped,
      columns,
      metadata: {
        filename: files.map(f => f.name).join(', '),
        upload_time: new Date().toISOString(),
        week_number: latestWeek.week,
        year: latestWeek.year,
        row_count: deduped.length,
        file_size_mb: 0,
        uploader: session.user?.name || session.user?.email || 'unknown',
        replaced_backup: null,
        years,
      },
    };

    const jsonContent = JSON.stringify(dataPackage, null, 2);
    dataPackage.metadata.file_size_mb = parseFloat((Buffer.byteLength(jsonContent) / 1024 / 1024).toFixed(2));

    // Upload to GitHub
    await uploadToGitHub(jsonContent);

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: deduped.length,
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

// ==================== GITHUB UPLOAD ====================

async function uploadToGitHub(content: string) {
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'HC-Dashboard-Upload',
  };

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`;

  // Get current file SHA (needed for update)
  let sha: string | undefined;
  const getRes = await fetch(apiUrl, { headers, cache: 'no-store' });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  // Upload/update file
  const body: Record<string, unknown> = {
    message: `Update HC dashboard data - ${new Date().toISOString()}`,
    content: Buffer.from(content).toString('base64'),
  };
  if (sha) {
    body.sha = sha;
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub upload failed: ${putRes.status} - ${errText}`);
  }
}
