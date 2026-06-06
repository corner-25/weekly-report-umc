// Client-side cache for AI import results, keyed by file hash + week + year.
// Lives in localStorage so the user can reload the page and resume.

interface CacheEntry {
  fileHash: string;
  fileName: string;
  weekNumber: number;
  year: number;
  savedAt: number;
  // departmentId → result
  results: Record<string, DeptResultSnapshot>;
}

export interface DeptResultSnapshot {
  sheetName: string;
  departmentId: string;
  departmentName: string;
  masterTaskCount: number;
  metricDefCount: number;
  tasks: Array<{ masterTaskId: string; taskName: string; result: string; confidence: number }>;
  metrics: Array<{ metricId: string; metricName: string; value: number | null; note: string | null; confidence: number }>;
  newTasks: Array<{ taskName: string; result: string; suggestedMasterTaskName?: string }>;
  dormantTasks: string[];
  newMetrics: Array<{ metricName: string; value: number; unit?: string; context?: string }>;
  unmatched: string[];
}

const STORAGE_PREFIX = 'ai-import-cache:';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(fileHash: string, weekNumber: number, year: number): string {
  return `${STORAGE_PREFIX}${fileHash}:${weekNumber}-${year}`;
}

/**
 * Compute a short SHA-256 hex digest of the file. Truncated to 16 chars to
 * keep localStorage keys readable; collision risk is negligible for our use.
 */
export async function computeFileHash(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < 8; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

export function loadCache(fileHash: string, weekNumber: number, year: number): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(fileHash, weekNumber, year));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    // Drop entries older than a week
    if (Date.now() - parsed.savedAt > ONE_WEEK_MS) {
      localStorage.removeItem(cacheKey(fileHash, weekNumber, year));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveResultsToCache(
  fileHash: string,
  fileName: string,
  weekNumber: number,
  year: number,
  results: DeptResultSnapshot[],
): void {
  try {
    const existing = loadCache(fileHash, weekNumber, year);
    const merged: Record<string, DeptResultSnapshot> = { ...(existing?.results ?? {}) };
    for (const r of results) merged[r.departmentId] = r;
    const entry: CacheEntry = {
      fileHash,
      fileName,
      weekNumber,
      year,
      savedAt: Date.now(),
      results: merged,
    };
    localStorage.setItem(cacheKey(fileHash, weekNumber, year), JSON.stringify(entry));
  } catch (e) {
    // Quota exceeded or other storage failure — silent.
    console.warn('saveResultsToCache failed', e);
  }
}

export function clearCache(fileHash: string, weekNumber: number, year: number): void {
  try {
    localStorage.removeItem(cacheKey(fileHash, weekNumber, year));
  } catch {
    /* ignore */
  }
}

export function listCachedDepartments(entry: CacheEntry | null): DeptResultSnapshot[] {
  if (!entry) return [];
  return Object.values(entry.results);
}
