// ==================== PHÒNG HC DASHBOARD TYPES ====================

/** Raw row from the Excel/JSON data */
export interface PhongHcRow {
  'Danh mục': string;
  'Nội dung': string;
  'Năm': number;
  'Tháng': number;
  'Tuần': number;
  'Số liệu': number;
}

/** Processed row with computed fields */
export interface ProcessedRow extends PhongHcRow {
  quarter: number;
  categoryOrder: number;
  contentOrder: number;
  weekOverWeekRatio: number | null;
  weekOverWeekChange: number | null;
}

/** Pivot cell value */
export interface PivotCell {
  value: number;
  ratio: number | null;
  change: number | null;
}

/** Pivot table row (one per Nội dung) */
export interface PivotRow {
  category: string;
  content: string;
  cells: Record<string, PivotCell>;
  total: number;
  aggregationMethod: AggregationMethod;
}

/** Aggregation method per content type */
export type AggregationMethod = 'sum' | 'mean' | 'last';

/** Report type */
export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/** Time filter range */
export interface TimeFilter {
  fromYear: number;
  fromMonth: number;
  fromWeek: number;
  toYear: number;
  toMonth: number;
  toWeek: number;
}

/** Quick filter preset */
export interface QuickFilterPreset {
  label: string;
  icon: string;
  getFilter: (data: ProcessedRow[]) => TimeFilter;
}

/** Chart type for trend view */
export type ChartType = 'line' | 'bar' | 'area';

/** Category with icon mapping */
export interface CategoryConfig {
  name: string;
  icon: string;
  priority: number;
}

/** GitHub data package format */
export interface GitHubDataPackage {
  data: Record<string, unknown>[];
  columns: string[];
  metadata: {
    filename: string;
    upload_time: string;
    week_number: number;
    year: number;
    row_count: number;
    file_size_mb: number;
    uploader: string;
    replaced_backup: string | null;
  };
}

/** Dashboard stats for summary cards */
export interface DashboardStats {
  totalCategories: number;
  totalContents: number;
  totalWeeks: number;
  latestWeek: number;
  latestYear: number;
  dataRows: number;
  years: number[];
}
