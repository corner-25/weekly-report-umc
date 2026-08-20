import type { PrismaClient, SyncSource, SyncSourceKind } from '@prisma/client';

/** Mức độ nghiêm trọng của một dòng log trong lần chạy đồng bộ. */
export type LogLevel = 'info' | 'warn' | 'error';

/** Nguyên nhân kích hoạt một lần chạy. */
export type SyncTrigger = 'cron' | 'manual' | 'webhook';

/**
 * Ngữ cảnh runner truyền cho connector. Connector dùng ctx để ghi log và đọc
 * cấu hình nguồn; nó không tự tạo SyncRun hay tự bắt lỗi — runner lo việc đó.
 */
export interface SyncContext {
  readonly runId: string;
  readonly source: SyncSource;
  readonly prisma: PrismaClient;
  readonly trigger: SyncTrigger;
  /** Ghi một dòng log gắn với lần chạy hiện tại. */
  log(level: LogLevel, message: string, context?: unknown): Promise<void>;
}

/** Dữ liệu thô lấy từ nguồn, kèm checksum để phát hiện nguồn không đổi. */
export interface FetchResult<TRaw = unknown> {
  raw: TRaw;
  checksum: string;
}

/** Kết quả ghi vào database của một lần chạy. */
export interface UpsertResult {
  upserted: number;
  skipped: number;
}

/**
 * Hợp đồng của một nguồn dữ liệu. Mỗi connector chỉ khai báo ba việc:
 * lấy dữ liệu, chuyển thành dòng đã kiểm chứng, và ghi vào bảng đích.
 *
 * Phần chung — tạo SyncRun, so checksum, bắt lỗi, ghi SyncLog, cập nhật
 * lastSuccessAt — do runner đảm nhiệm, connector không lặp lại.
 */
export interface Connector<TRaw = unknown, TRow = unknown> {
  readonly id: string;
  readonly name: string;
  readonly kind: SyncSourceKind;

  fetch(ctx: SyncContext): Promise<FetchResult<TRaw>>;
  parse(raw: TRaw, ctx: SyncContext): Promise<TRow[]>;
  upsert(rows: TRow[], ctx: SyncContext): Promise<UpsertResult>;
}

/** Tóm tắt một lần chạy, trả về cho API và trang quản trị. */
export interface SyncRunSummary {
  sourceId: string;
  sourceName: string;
  runId: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  rowsRead: number;
  rowsUpserted: number;
  rowsSkipped: number;
  durationMs: number;
  errorMessage?: string;
}
