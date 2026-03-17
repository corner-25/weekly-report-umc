import type {
  PhongHcRow,
  ProcessedRow,
  PivotRow,
  PivotCell,
  AggregationMethod,
  TimeFilter,
  ReportType,
  DashboardStats,
  CategoryConfig,
  GitHubDataPackage,
} from './types';

// ==================== PRIORITY CONFIGURATION ====================

export const CATEGORY_PRIORITY: Record<string, number> = {
  'Văn bản đến': 1,
  'Văn bản phát hành': 2,
  'Chăm sóc khách vip': 3,
  'Lễ tân': 4,
  'Tiếp khách trong nước': 5,
  'Sự kiện': 6,
  'Đón tiếp khách VIP': 7,
  'Tổ chức cuộc họp trực tuyến': 8,
  'Trang điều hành tác nghiệp': 9,
  'Tổ xe': 10,
  'Tổng đài': 11,
  'Hệ thống thư ký Bệnh viện': 12,
  'Bãi giữ xe': 13,
};

export const CATEGORY_ICONS: Record<string, string> = {
  'Văn bản đến': '📥',
  'Văn bản phát hành': '📤',
  'Chăm sóc khách vip': '⭐',
  'Lễ tân': '🏪',
  'Tiếp khách trong nước': '🤝',
  'Sự kiện': '🎉',
  'Đón tiếp khách VIP': '👑',
  'Tổ chức cuộc họp trực tuyến': '💻',
  'Trang điều hành tác nghiệp': '📊',
  'Tổ xe': '🚗',
  'Tổng đài': '📞',
  'Hệ thống thư ký Bệnh viện': '👥',
  'Bãi giữ xe': '🅿️',
};

export const CONTENT_PRIORITY: Record<string, number> = {
  // Văn bản đến
  'Tổng số văn bản đến, trong đó:': 1,
  'Số văn bản không yêu cầu phản hồi': 2,
  'Số văn bản yêu cầu phản hồi': 3,
  'Xử lý đúng hạn': 4,
  'Xử lý trễ hạn': 5,
  // Văn bản phát hành
  'Văn bản đi': 6,
  'Hợp đồng': 7,
  'Quyết định': 8,
  'Quy chế': 9,
  'Quy định': 10,
  'Quy trình': 11,
  // Chăm sóc khách vip
  'Tiếp đón, hướng dẫn và phục vụ khách VIP': 12,
  // Lễ tân
  'Hỗ trợ lễ tân cho hội nghị/hội thảo': 13,
  // Tiếp khách trong nước
  'Tổng số đoàn khách trong nước, trong đó:': 14,
  'Tham quan, học tập': 15,
  'Làm việc': 16,
  // Sự kiện
  'Tổng số sự kiện hành chính của Bệnh viện, trong đó:': 17,
  'Phòng Hành chính chủ trì': 18,
  'Phòng Hành chính phối hợp': 19,
  // Đón tiếp khách VIP
  'Số lượt khách VIP được lễ tân tiếp đón, hỗ trợ khám chữa bệnh': 20,
  // Tổ chức cuộc họp trực tuyến
  'Tổng số cuộc họp trực tuyến do Phòng Hành chính chuẩn bị': 21,
  // Trang điều hành tác nghiệp
  'Số lượng tin đăng ĐHTN': 22,
  // Tổ xe
  'Số chuyến xe': 23,
  'Tổng số nhiên liệu tiêu thụ': 24,
  'Tổng km chạy': 25,
  'Xe hành chính': 26,
  'Xe cứu thương': 27,
  'Chi phí bảo dưỡng': 28,
  'Doanh thu': 29,
  'Số phiếu khảo sát hài lòng': 31,
  'Tỷ lệ hài lòng của khách hàng': 32,
  // Tổng đài
  'Tổng số cuộc gọi đến Bệnh viện': 33,
  'Tổng số cuộc gọi nhỡ do từ chối': 34,
  'Tổng số cuộc gọi nhỡ do không bắt máy': 35,
  'Số cuộc gọi đến (Nhánh 0-Tổng đài viên)': 36,
  'Nhỡ do từ chối (Nhánh 0-Tổng đài viên)': 37,
  'Nhỡ do không bắt máy (Nhánh 0-Tổng đài viên)': 38,
  'Số cuộc gọi đến (Nhánh 1-Cấp cứu)': 39,
  'Nhỡ do từ chối (Nhánh 1-Cấp cứu)': 40,
  'Nhỡ do không bắt máy (Nhánh 1-Cấp cứu)': 41,
  'Số cuộc gọi đến (Nhánh 2-Tư vấn Thuốc)': 42,
  'Nhỡ do từ chối (Nhánh 2- Tư vấn Thuốc)': 43,
  'Nhỡ do không bắt máy (Nhánh 2-Tư vấn Thuốc)': 44,
  'Số cuộc gọi đến (Nhánh 3-PKQT)': 45,
  'Nhỡ do từ chối (Nhánh 3-PKQT)': 46,
  'Nhỡ do không bắt máy  (Nhánh 3-PKQT)': 47,
  'Số cuộc gọi đến (Nhánh 4-Vấn đề khác)': 48,
  'Nhỡ do từ chối (Nhánh 4-Vấn đề khác)': 49,
  'Nhỡ do không bắt máy (Nhánh 4-Vấn đề khác)': 50,
  'Hottline': 51,
  // Hệ thống thư ký Bệnh viện
  'Số thư ký được sơ tuyển': 52,
  'Số thư ký được tuyển dụng': 53,
  'Số thư ký nhận việc': 54,
  'Số thư ký nghỉ việc': 55,
  'Số thư ký được điều động': 56,
  'Tổng số thư ký': 57,
  '- Thư ký hành chính': 58,
  '- Thư ký chuyên môn': 59,
  'Số buổi sinh hoạt cho thư ký': 60,
  'Số thư ký tham gia sinh hoạt': 61,
  'Số buổi tập huấn, đào tạo cho thư ký': 62,
  'Số thư ký tham gia tập huấn, đào tạo': 63,
  'Số buổi tham quan, học tập': 64,
  'Số thư ký tham gia tham quan, học tập': 65,
  // Bãi giữ xe
  'Tổng số lượt vé ngày': 66,
  'Tổng số lượt vé tháng': 67,
  'Công suất trung bình/ngày': 68,
  'Số phản ánh khiếu nại': 70,
};

// ==================== AGGREGATION CONFIG ====================

const AGGREGATION_RULES: Record<string, AggregationMethod> = {
  'Tỷ lệ hài lòng của khách hàng': 'mean',
  'Tỷ lệ hài lòng khách hàng': 'mean',
  'Công suất trung bình/ngày': 'mean',
  'Tổng số thư ký': 'last',
  '- Thư ký hành chính': 'last',
  '- Thư ký chuyên môn': 'last',
  'Doanh thu': 'sum',
  'Chi phí bảo dưỡng': 'sum',
};

export function getAggregationMethod(content: string): AggregationMethod {
  if (AGGREGATION_RULES[content]) return AGGREGATION_RULES[content];

  const normalized = content.trim().replace(/^[-•:\s]+/, '');
  if (AGGREGATION_RULES[normalized]) return AGGREGATION_RULES[normalized];

  const lower = content.toLowerCase().trim();
  if (['tỷ lệ', 'ty le', '%', 'phần trăm'].some((k) => lower.includes(k))) return 'mean';
  if (lower.includes('tổng số') && lower.includes('thư ký')) return 'last';
  if (['thư ký hành chính', 'thư ký chuyên môn'].some((k) => lower.includes(k))) return 'last';
  if (['trung bình', 'trung binh'].some((k) => lower.includes(k))) return 'mean';

  return 'sum';
}

// ==================== DATA PARSING ====================

export function parseGitHubData(pkg: GitHubDataPackage): PhongHcRow[] {
  return pkg.data.map((record) => ({
    'Danh mục': String(record['Danh mục'] ?? '').trim(),
    'Nội dung': String(record['Nội dung'] ?? '').trim(),
    'Năm': Number(record['Năm']) || new Date().getFullYear(),
    'Tháng': Number(record['Tháng']) || 1,
    'Tuần': Number(record['Tuần']) || 1,
    'Số liệu': Number(record['Số liệu']) || 0,
  }));
}

// ==================== DATA PROCESSING ====================

export function processData(raw: PhongHcRow[]): ProcessedRow[] {
  // Add computed fields
  const rows: ProcessedRow[] = raw.map((r) => ({
    ...r,
    quarter: Math.ceil(r['Tháng'] / 3),
    categoryOrder: CATEGORY_PRIORITY[r['Danh mục']] ?? 999,
    contentOrder: CONTENT_PRIORITY[r['Nội dung']] ?? 999,
    weekOverWeekRatio: null,
    weekOverWeekChange: null,
  }));

  // Sort by priority, then by time descending
  rows.sort((a, b) => {
    if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
    if (a.contentOrder !== b.contentOrder) return a.contentOrder - b.contentOrder;
    if (a['Năm'] !== b['Năm']) return b['Năm'] - a['Năm'];
    if (a['Tháng'] !== b['Tháng']) return b['Tháng'] - a['Tháng'];
    return b['Tuần'] - a['Tuần'];
  });

  // Calculate week-over-week changes
  const groups = new Map<string, ProcessedRow[]>();
  for (const row of rows) {
    const key = `${row['Danh mục']}||${row['Nội dung']}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  for (const group of groups.values()) {
    // Sort ascending for WoW calculation
    const sorted = [...group].sort((a, b) => {
      if (a['Năm'] !== b['Năm']) return a['Năm'] - b['Năm'];
      if (a['Tháng'] !== b['Tháng']) return a['Tháng'] - b['Tháng'];
      return a['Tuần'] - b['Tuần'];
    });

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]['Số liệu'];
      const previous = sorted[i - 1]['Số liệu'];
      if (previous !== 0) {
        sorted[i].weekOverWeekRatio = ((current - previous) / previous) * 100;
        sorted[i].weekOverWeekChange = current - previous;
      } else if (current > 0) {
        sorted[i].weekOverWeekRatio = 999;
        sorted[i].weekOverWeekChange = current;
      }
    }
  }

  return rows;
}

// ==================== FILTERING ====================

export function filterData(
  data: ProcessedRow[],
  filter: TimeFilter,
  categories: string[]
): ProcessedRow[] {
  return data.filter((row) => {
    if (!categories.includes(row['Danh mục'])) return false;

    // Start condition
    const afterStart =
      row['Năm'] > filter.fromYear ||
      (row['Năm'] === filter.fromYear && row['Tháng'] > filter.fromMonth) ||
      (row['Năm'] === filter.fromYear &&
        row['Tháng'] === filter.fromMonth &&
        row['Tuần'] >= filter.fromWeek);

    // End condition
    const beforeEnd =
      row['Năm'] < filter.toYear ||
      (row['Năm'] === filter.toYear && row['Tháng'] < filter.toMonth) ||
      (row['Năm'] === filter.toYear &&
        row['Tháng'] === filter.toMonth &&
        row['Tuần'] <= filter.toWeek);

    return afterStart && beforeEnd;
  });
}

// ==================== AGGREGATION BY REPORT TYPE ====================

interface AggregatedRow {
  category: string;
  content: string;
  timeKey: string;
  value: number;
  ratio: number | null;
  change: number | null;
}

export function aggregateByReportType(
  data: ProcessedRow[],
  reportType: ReportType
): AggregatedRow[] {
  if (reportType === 'weekly') {
    return data.map((r) => ({
      category: r['Danh mục'],
      content: r['Nội dung'],
      timeKey: `${r['Năm']}-W${String(r['Tuần']).padStart(2, '0')}`,
      value: r['Số liệu'],
      ratio: r.weekOverWeekRatio,
      change: r.weekOverWeekChange,
    }));
  }

  // Group by time period
  const groups = new Map<string, { rows: ProcessedRow[]; timeKey: string }>();

  for (const row of data) {
    let timeKey: string;
    let groupKey: string;

    switch (reportType) {
      case 'monthly':
        timeKey = `T${row['Tháng']}/${row['Năm']}`;
        groupKey = `${row['Danh mục']}||${row['Nội dung']}||${row['Năm']}-${row['Tháng']}`;
        break;
      case 'quarterly':
        timeKey = `Q${row.quarter}/${row['Năm']}`;
        groupKey = `${row['Danh mục']}||${row['Nội dung']}||${row['Năm']}-Q${row.quarter}`;
        break;
      case 'yearly':
        timeKey = String(row['Năm']);
        groupKey = `${row['Danh mục']}||${row['Nội dung']}||${row['Năm']}`;
        break;
      default:
        timeKey = `${row['Năm']}-W${row['Tuần']}`;
        groupKey = `${row['Danh mục']}||${row['Nội dung']}||${timeKey}`;
    }

    if (!groups.has(groupKey)) groups.set(groupKey, { rows: [], timeKey });
    groups.get(groupKey)!.rows.push(row);
  }

  const result: AggregatedRow[] = [];
  for (const { rows, timeKey } of groups.values()) {
    const first = rows[0];
    const method = getAggregationMethod(first['Nội dung']);

    let value: number;
    switch (method) {
      case 'mean':
        value = rows.reduce((s, r) => s + r['Số liệu'], 0) / rows.length;
        break;
      case 'last': {
        const sorted = [...rows].sort((a, b) => {
          if (a['Năm'] !== b['Năm']) return a['Năm'] - b['Năm'];
          if (a['Tháng'] !== b['Tháng']) return a['Tháng'] - b['Tháng'];
          return a['Tuần'] - b['Tuần'];
        });
        value = sorted[sorted.length - 1]['Số liệu'];
        break;
      }
      default:
        value = rows.reduce((s, r) => s + r['Số liệu'], 0);
    }

    result.push({
      category: first['Danh mục'],
      content: first['Nội dung'],
      timeKey,
      value,
      ratio: null,
      change: null,
    });
  }

  return result;
}

// ==================== PIVOT TABLE BUILDER ====================

export function buildPivotTable(aggregated: AggregatedRow[]): {
  rows: PivotRow[];
  timeColumns: string[];
} {
  // Collect all time columns
  const timeColSet = new Set<string>();
  for (const row of aggregated) timeColSet.add(row.timeKey);

  // Sort time columns descending (newest first)
  const timeColumns = Array.from(timeColSet).sort((a, b) => {
    // Parse to compare: handle "2026-W05", "T3/2026", "Q1/2026", "2026"
    return b.localeCompare(a);
  });

  // Group by category + content
  const pivotMap = new Map<string, PivotRow>();

  for (const row of aggregated) {
    const key = `${row.category}||${row.content}`;
    if (!pivotMap.has(key)) {
      pivotMap.set(key, {
        category: row.category,
        content: row.content,
        cells: {},
        total: 0,
        aggregationMethod: getAggregationMethod(row.content),
      });
    }
    const pivotRow = pivotMap.get(key)!;
    pivotRow.cells[row.timeKey] = {
      value: row.value,
      ratio: row.ratio,
      change: row.change,
    };
  }

  // Calculate totals
  for (const pivotRow of pivotMap.values()) {
    const values = Object.values(pivotRow.cells).map((c) => c.value);
    switch (pivotRow.aggregationMethod) {
      case 'mean':
        pivotRow.total = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
        break;
      case 'last':
        pivotRow.total = values.length > 0 ? values[0] : 0; // First column = newest
        break;
      default:
        pivotRow.total = values.reduce((s, v) => s + v, 0);
    }
  }

  // Sort by priority
  const rows = Array.from(pivotMap.values()).sort((a, b) => {
    const catA = CATEGORY_PRIORITY[a.category] ?? 999;
    const catB = CATEGORY_PRIORITY[b.category] ?? 999;
    if (catA !== catB) return catA - catB;
    const contA = CONTENT_PRIORITY[a.content] ?? 999;
    const contB = CONTENT_PRIORITY[b.content] ?? 999;
    return contA - contB;
  });

  return { rows, timeColumns };
}

// ==================== CATEGORY CONFIGS ====================

export function getCategoryConfigs(data: ProcessedRow[]): CategoryConfig[] {
  const categories = new Set(data.map((r) => r['Danh mục']));
  return Array.from(categories)
    .map((name) => ({
      name,
      icon: CATEGORY_ICONS[name] ?? '📁',
      priority: CATEGORY_PRIORITY[name] ?? 999,
    }))
    .sort((a, b) => a.priority - b.priority);
}

// ==================== STATS ====================

export function computeStats(data: ProcessedRow[]): DashboardStats {
  const categories = new Set(data.map((r) => r['Danh mục']));
  const contents = new Set(data.map((r) => r['Nội dung']));
  const weeks = new Set(data.map((r) => `${r['Năm']}-${r['Tuần']}`));
  const years = Array.from(new Set(data.map((r) => r['Năm']))).sort();

  let latestWeek = 0;
  let latestYear = 0;
  for (const row of data) {
    if (
      row['Năm'] > latestYear ||
      (row['Năm'] === latestYear && row['Tuần'] > latestWeek)
    ) {
      latestYear = row['Năm'];
      latestWeek = row['Tuần'];
    }
  }

  return {
    totalCategories: categories.size,
    totalContents: contents.size,
    totalWeeks: weeks.size,
    latestWeek,
    latestYear,
    dataRows: data.length,
    years,
  };
}

// ==================== FORMAT HELPERS ====================

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  }
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

export function formatNumberFull(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

export function getChangeColor(ratio: number | null): string {
  if (ratio === null || ratio === 0) return 'text-gray-400';
  return ratio > 0 ? 'text-emerald-600' : 'text-red-500';
}

export function getChangeBg(ratio: number | null): string {
  if (ratio === null || ratio === 0) return '';
  return ratio > 0 ? 'bg-emerald-50' : 'bg-red-50';
}

export function getChangeArrow(ratio: number | null): string {
  if (ratio === null || ratio === 0) return '';
  if (ratio === 999) return '↑∞';
  return ratio > 0 ? '↑' : '↓';
}

// ==================== QUICK FILTER PRESETS ====================

export function getQuickFilters(data: ProcessedRow[]): { label: string; icon: string; filter: TimeFilter }[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  const maxWeek = Math.max(...data.filter((r) => r['Năm'] === currentYear).map((r) => r['Tuần']), 1);
  const years = Array.from(new Set(data.map((r) => r['Năm']))).sort();
  const minYear = years[0] ?? currentYear;
  const maxYear = years[years.length - 1] ?? currentYear;

  return [
    {
      label: '4 tuần gần nhất',
      icon: '📅',
      filter: {
        fromYear: currentYear,
        fromMonth: 1,
        fromWeek: Math.max(1, maxWeek - 3),
        toYear: currentYear,
        toMonth: 12,
        toWeek: maxWeek,
      },
    },
    {
      label: 'Tháng này',
      icon: '📅',
      filter: {
        fromYear: currentYear,
        fromMonth: currentMonth,
        fromWeek: 1,
        toYear: currentYear,
        toMonth: currentMonth,
        toWeek: 53,
      },
    },
    {
      label: 'Quý này',
      icon: '📅',
      filter: {
        fromYear: currentYear,
        fromMonth: (currentQuarter - 1) * 3 + 1,
        fromWeek: 1,
        toYear: currentYear,
        toMonth: currentQuarter * 3,
        toWeek: 53,
      },
    },
    {
      label: 'Tất cả',
      icon: '📅',
      filter: {
        fromYear: minYear,
        fromMonth: 1,
        fromWeek: 1,
        toYear: maxYear,
        toMonth: 12,
        toWeek: 53,
      },
    },
    {
      label: 'Tháng trước',
      icon: '📅',
      filter: {
        fromYear: currentMonth > 1 ? currentYear : currentYear - 1,
        fromMonth: currentMonth > 1 ? currentMonth - 1 : 12,
        fromWeek: 1,
        toYear: currentMonth > 1 ? currentYear : currentYear - 1,
        toMonth: currentMonth > 1 ? currentMonth - 1 : 12,
        toWeek: 53,
      },
    },
    {
      label: '6T đầu năm',
      icon: '📅',
      filter: {
        fromYear: currentYear,
        fromMonth: 1,
        fromWeek: 1,
        toYear: currentYear,
        toMonth: 6,
        toWeek: 53,
      },
    },
    {
      label: '6T cuối năm',
      icon: '📅',
      filter: {
        fromYear: currentYear,
        fromMonth: 7,
        fromWeek: 1,
        toYear: currentYear,
        toMonth: 12,
        toWeek: 53,
      },
    },
  ];
}
