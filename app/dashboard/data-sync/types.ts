/** Kiểu dữ liệu trả về từ /api/sync-admin. */

export interface SyncSourceRow {
  id: string;
  name: string;
  kind: string;
  cronEnabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
}

export interface SyncRunRow {
  id: string;
  sourceId: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  rowsUpserted: number;
  rowsSkipped: number;
  errorMessage: string | null;
}

export interface PendingImportRow {
  id: string;
  year: number;
  week: number;
  sheetName: string;
  createdAt: string;
}

export interface SyncAdminData {
  sources: SyncSourceRow[];
  recentRuns: SyncRunRow[];
  pending: PendingImportRow[];
  stats: {
    hcMetrics: number;
    fleetTrips: number;
    pendingCount: number;
  };
}

export interface SyncLogRow {
  id: string;
  level: string;
  message: string;
  context: unknown;
  createdAt: string;
}
