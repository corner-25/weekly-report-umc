'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet, RefreshCw, Plus, Database, Trash2 } from 'lucide-react';
import { computeFileHash, loadCache, saveResultsToCache, clearCache, listCachedDepartments } from '@/lib/chatbot/ai-import-cache';

interface AiTask { masterTaskId: string; taskName: string; result: string; confidence: number }
interface AiMetric { metricId: string; metricName: string; value: number | null; note: string | null; confidence: number }
interface AiNewTask { taskName: string; result: string; suggestedMasterTaskName?: string }
interface AiNewMetric { metricName: string; value: number; unit?: string; context?: string }

interface DeptResult {
  sheetName: string;
  departmentId: string;
  departmentName: string;
  masterTaskCount: number;
  metricDefCount: number;
  tasks: AiTask[];
  metrics: AiMetric[];
  newTasks: AiNewTask[];
  dormantTasks: string[];
  newMetrics: AiNewMetric[];
  unmatched: string[];
  error?: string;
}

interface ProgressEvent {
  index: number;
  total: number;
  deptName: string;
  status: 'matching' | 'done' | 'skipped' | 'error';
  taskCount?: number;
  metricCount?: number;
  newTaskCount?: number;
  dormantTaskCount?: number;
  reason?: string;
  error?: string;
}

type Phase = 'idle' | 'parsing' | 'matching' | 'review' | 'saving' | 'success' | 'error';

export function AiReportImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [weekNumber, setWeekNumber] = useState<number>(getCurrentISOWeek());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [results, setResults] = useState<DeptResult[]>([]);
  const [savedWeekId, setSavedWeekId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [excludedTasks, setExcludedTasks] = useState<Set<string>>(new Set());
  const [excludedMetrics, setExcludedMetrics] = useState<Set<string>>(new Set());

  // Per-dept ephemeral state for retry / add-to-DB actions
  const [retryingDeptIds, setRetryingDeptIds] = useState<Set<string>>(new Set());
  const [addingDeptIds, setAddingDeptIds] = useState<Set<string>>(new Set());
  const [failedDepts, setFailedDepts] = useState<Array<{ sheetName: string; departmentId?: string; departmentName?: string; reason: string }>>([]);

  // Cache state
  const [fileHash, setFileHash] = useState<string>('');
  const [cachedSheetNames, setCachedSheetNames] = useState<string[]>([]); // sheetNames already in cache for current hash+week+year
  const [cachedDeptCount, setCachedDeptCount] = useState<number>(0);
  const [freshDeptIds, setFreshDeptIds] = useState<Set<string>>(new Set()); // dept ids newly parsed this session

  // Recompute hash + load cache whenever file/week/year changes
  useEffect(() => {
    let cancelled = false;
    if (!file || !weekNumber || !year) {
      setFileHash('');
      setCachedSheetNames([]);
      setCachedDeptCount(0);
      return;
    }
    (async () => {
      const hash = await computeFileHash(file);
      if (cancelled) return;
      setFileHash(hash);
      const entry = loadCache(hash, weekNumber, year);
      const cached = listCachedDepartments(entry);
      setCachedSheetNames(cached.map((c) => c.sheetName));
      setCachedDeptCount(cached.length);
    })();
    return () => { cancelled = true; };
  }, [file, weekNumber, year]);

  function toggleTask(deptId: string, masterTaskId: string) {
    const key = `${deptId}|${masterTaskId}`;
    setExcludedTasks((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleMetric(deptId: string, metricId: string) {
    const key = `${deptId}|${metricId}`;
    setExcludedMetrics((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function start() {
    if (!file || !weekNumber || !year || !startDate || !endDate) {
      setErrorMsg('Vui lòng chọn file và điền đầy đủ thông tin');
      return;
    }
    setErrorMsg('');
    setPhase('parsing');
    setProgressEvents([]);
    setFailedDepts([]);
    setFreshDeptIds(new Set());

    // Seed results from cache so user sees them while we process the rest.
    const cacheEntry = loadCache(fileHash, weekNumber, year);
    const seeded = listCachedDepartments(cacheEntry);
    setResults(seeded);

    const form = new FormData();
    form.append('file', file);
    form.append('weekNumber', String(weekNumber));
    form.append('year', String(year));
    if (seeded.length > 0) {
      // Tell the API to skip these sheet names entirely.
      form.append('skipSheets', seeded.map((s) => s.sheetName).join('\n'));
    }

    const res = await fetch('/api/import/ai-match', { method: 'POST', body: form });
    if (!res.ok || !res.body) {
      setPhase('error');
      setErrorMsg(`Lỗi server ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let lastEvent = 'message';
    setPhase('matching');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const seg of parts) {
        const lines = seg.split('\n');
        let data: string | null = null;
        for (const line of lines) {
          if (line.startsWith('event:')) lastEvent = line.slice(6).trim();
          else if (line.startsWith('data:')) data = line.slice(5).trim();
        }
        if (!data) continue;
        try {
          const obj = JSON.parse(data);
          if (lastEvent === 'progress') {
            const pe = obj as ProgressEvent;
            setProgressEvents((prev) => [...prev, pe]);
            if (pe.status === 'error' || pe.status === 'skipped') {
              setFailedDepts((prev) => [
                ...prev,
                {
                  sheetName: pe.deptName,
                  departmentName: pe.deptName,
                  reason: pe.error || pe.reason || 'unknown',
                },
              ]);
            }
          } else if (lastEvent === 'complete') {
            const freshResults = obj.results as DeptResult[];
            setFreshDeptIds(new Set(freshResults.map((r) => r.departmentId)));
            // Merge fresh with whatever cache had: fresh overrides cache for same dept.
            setResults((prev) => {
              const byId = new Map<string, DeptResult>();
              for (const r of prev) byId.set(r.departmentId, r);
              for (const r of freshResults) byId.set(r.departmentId, r);
              return Array.from(byId.values());
            });
            // Persist cache (fresh adds, cache for skipped already there).
            if (fileHash && file) {
              saveResultsToCache(fileHash, file.name, weekNumber, year, freshResults);
              // Refresh cache state for the UI counter
              const entry = loadCache(fileHash, weekNumber, year);
              const cached = listCachedDepartments(entry);
              setCachedSheetNames(cached.map((c) => c.sheetName));
              setCachedDeptCount(cached.length);
            }
            setPhase('review');
          } else if (lastEvent === 'error') {
            setErrorMsg(obj.error || 'Lỗi');
            setPhase('error');
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  async function retryDept(sheetName: string, departmentId?: string) {
    if (!file || !weekNumber || !year) return;
    const key = departmentId ?? sheetName;
    setRetryingDeptIds((s) => new Set(s).add(key));
    try {
      // If departmentId is missing (skipped case), we cannot retry without it
      if (!departmentId) {
        setErrorMsg(`Không thể thử lại "${sheetName}" — không tìm thấy phòng tương ứng trong DB. Hãy tạo phòng trước.`);
        return;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('weekNumber', String(weekNumber));
      form.append('year', String(year));
      form.append('sheetDeptName', sheetName);
      form.append('departmentId', departmentId);

      const res = await fetch('/api/import/ai-match-dept', { method: 'POST', body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `Lỗi ${res.status}` }));
        setErrorMsg(j.error || `Lỗi ${res.status}`);
        return;
      }
      const dr = (await res.json()) as DeptResult;
      // Remove this dept from failedDepts and merge into results.
      setFailedDepts((prev) => prev.filter((f) => (f.departmentId ?? f.sheetName) !== key));
      setResults((prev) => {
        const without = prev.filter((r) => r.departmentId !== dr.departmentId);
        return [...without, dr];
      });
      setFreshDeptIds((s) => new Set(s).add(dr.departmentId));
      // Overwrite cache for this dept.
      if (fileHash && file) {
        saveResultsToCache(fileHash, file.name, weekNumber, year, [dr]);
        const entry = loadCache(fileHash, weekNumber, year);
        const cached = listCachedDepartments(entry);
        setCachedSheetNames(cached.map((c) => c.sheetName));
        setCachedDeptCount(cached.length);
      }
      // If we're still in matching phase but everything done, jump to review.
      // Otherwise stay in current phase (review or matching).
      if (phase === 'matching' || phase === 'error') setPhase('review');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      setRetryingDeptIds((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  async function addNewTasksToDb(departmentId: string, names: string[]) {
    if (names.length === 0) return;
    setAddingDeptIds((s) => new Set(s).add(departmentId));
    try {
      const res = await fetch('/api/master-tasks/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId, names }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `Lỗi ${res.status}` }));
        setErrorMsg(j.error || `Lỗi ${res.status}`);
        return;
      }
      // Drop the added newTasks from the dept result so user sees they're done.
      const addedNames = new Set(names);
      setResults((prev) =>
        prev.map((r) =>
          r.departmentId === departmentId
            ? { ...r, newTasks: r.newTasks.filter((nt) => !addedNames.has(nt.taskName)) }
            : r,
        ),
      );
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      setAddingDeptIds((s) => {
        const next = new Set(s);
        next.delete(departmentId);
        return next;
      });
    }
  }

  async function save() {
    if (results.length === 0) return;
    setPhase('saving');
    setErrorMsg('');

    const taskProgress: Array<{ masterTaskId: string; result: string }> = [];
    const metricValues: Array<{ metricId: string; value: number; note: string | null }> = [];
    for (const dr of results) {
      for (const t of dr.tasks) {
        if (excludedTasks.has(`${dr.departmentId}|${t.masterTaskId}`)) continue;
        taskProgress.push({ masterTaskId: t.masterTaskId, result: t.result });
      }
      for (const m of dr.metrics) {
        if (excludedMetrics.has(`${dr.departmentId}|${m.metricId}`)) continue;
        if (m.value === null || m.value === undefined) continue;
        metricValues.push({ metricId: m.metricId, value: m.value, note: m.note });
      }
    }

    const res = await fetch('/api/import/ai-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekNumber, year, startDate, endDate, taskProgress, metricValues }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'Lỗi' }));
      setErrorMsg(j.error || 'Lỗi');
      setPhase('error');
      return;
    }
    const json = await res.json();
    setSavedWeekId(json.id);
    setPhase('success');
    // Cache no longer useful once the week is saved.
    if (fileHash) {
      clearCache(fileHash, weekNumber, year);
      setCachedSheetNames([]);
      setCachedDeptCount(0);
    }
  }

  function handleClearCache() {
    if (!fileHash) return;
    clearCache(fileHash, weekNumber, year);
    setCachedSheetNames([]);
    setCachedDeptCount(0);
    setResults([]);
    setFreshDeptIds(new Set());
  }

  const matchedCount = progressEvents.filter((p) => p.status === 'done').length;
  const totalCount = progressEvents[0]?.total ?? 0;
  const pct = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 px-5 py-4">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Nhập báo cáo tuần bằng AI</h2>
        </div>
        <p className="text-white/80 text-xs mt-1">
          Upload Excel báo cáo tuần — DeepSeek tự match nhiệm vụ và chỉ số với DB, bạn review và lưu
        </p>
      </div>

      <div className="p-5 space-y-4">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            <p className="font-semibold">Lỗi</p>
            <p className="text-xs mt-1">{errorMsg}</p>
          </div>
        )}

        {phase === 'idle' && (
          <>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">File Excel báo cáo tuần *</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
              />
              {file && (
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
              {cachedDeptCount > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-cyan-800">
                    <Database className="w-3.5 h-3.5" />
                    <span>
                      Đã có <strong>{cachedDeptCount}</strong> phòng trong cache cho file này (tuần {weekNumber}/{year}) — sẽ skip khi chạy lại.
                    </span>
                  </div>
                  <button
                    onClick={handleClearCache}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100 rounded-md"
                  >
                    <Trash2 className="w-3 h-3" /> Xoá cache
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">Tuần *</label>
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">Năm *</label>
                <input
                  type="number"
                  min={2024}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">Từ ngày *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">Đến ngày *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <button
              onClick={start}
              disabled={!file}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                !file
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 text-white hover:shadow-md'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Bắt đầu phân tích bằng AI
            </button>
          </>
        )}

        {(phase === 'parsing' || phase === 'matching') && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
              <h3 className="font-semibold text-slate-900 text-sm">
                {phase === 'parsing' ? 'Đang đọc file Excel...' : `Đang xử lý ${matchedCount}/${totalCount} phòng`}
              </h3>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto text-sm bg-slate-50 rounded-lg p-3">
              {progressEvents.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-white">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : p.status === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : p.status === 'skipped' ? (
                      <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />
                    )}
                    <span className="truncate text-slate-700 text-xs">{p.deptName}</span>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0 tabular-nums">
                    {p.status === 'done' && (
                      <span>{p.taskCount} task · {p.metricCount} metric{(p.newTaskCount ?? 0) > 0 ? ` · +${p.newTaskCount} mới` : ''}{(p.dormantTaskCount ?? 0) > 0 ? ` · ${p.dormantTaskCount} dormant` : ''}</span>
                    )}
                    {p.status === 'matching' && <span>đang phân tích...</span>}
                    {p.status === 'error' && <span>{p.error}</span>}
                    {p.status === 'skipped' && <span>bỏ qua ({p.reason})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-3">
            {failedDepts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h3 className="font-semibold text-amber-900 text-sm">
                    {failedDepts.length} phòng chưa phân tích được — thử lại?
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {failedDepts.map((fd, i) => {
                    const key = fd.departmentId ?? fd.sheetName;
                    const isRetrying = retryingDeptIds.has(key);
                    // Try to resolve departmentId from results history or progressEvents
                    const matchingResult = results.find((r) => r.departmentName === fd.sheetName);
                    const deptId = fd.departmentId ?? matchingResult?.departmentId;
                    return (
                      <li key={i} className="flex items-center justify-between gap-2 bg-white border border-amber-100 rounded-md px-3 py-1.5">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-900 truncate">{fd.sheetName}</div>
                          <div className="text-[11px] text-amber-700 truncate">{fd.reason}</div>
                        </div>
                        <button
                          onClick={() => retryDept(fd.sheetName, deptId)}
                          disabled={isRetrying}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-md hover:bg-amber-200 disabled:opacity-50"
                        >
                          {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Thử lại
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg p-3">
              <div>
                <h3 className="font-semibold text-violet-900 text-sm">Phân tích xong — Xem lại trước khi lưu</h3>
                <p className="text-xs text-violet-700 mt-0.5">
                  {results.length} phòng · {results.reduce((s, r) => s + r.tasks.length, 0)} nhiệm vụ · {results.reduce((s, r) => s + r.metrics.length, 0)} chỉ số
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPhase('idle'); setResults([]); setProgressEvents([]); }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Huỷ
                </button>
                <button
                  onClick={save}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg"
                >
                  Lưu vào tuần {weekNumber}/{year}
                </button>
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto space-y-2.5">
              {results.map((dr) => {
                const isRetrying = retryingDeptIds.has(dr.departmentId);
                const isAdding = addingDeptIds.has(dr.departmentId);
                return (
                <div key={dr.departmentId} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-sm truncate flex items-center gap-1.5">
                        {dr.departmentName}
                        {!freshDeptIds.has(dr.departmentId) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 bg-cyan-100 rounded">
                            <Database className="w-2.5 h-2.5" />
                            cache
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {dr.tasks.length}/{dr.masterTaskCount} nhiệm vụ · {dr.metrics.length}/{dr.metricDefCount} chỉ số
                        {dr.newTasks.length > 0 && <> · <span className="text-violet-600">{dr.newTasks.length} task mới</span></>}
                        {dr.dormantTasks.length > 0 && <> · <span className="text-slate-500">{dr.dormantTasks.length} không hoạt động</span></>}
                      </div>
                    </div>
                    <button
                      onClick={() => retryDept(dr.departmentName, dr.departmentId)}
                      disabled={isRetrying}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
                      title="Chạy lại AI cho phòng này"
                    >
                      {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Chạy lại
                    </button>
                  </div>
                  <div className="px-4 py-2.5 space-y-2">
                    {dr.metrics.length > 0 && (
                      <details className="text-sm" open>
                        <summary className="cursor-pointer font-medium text-slate-700 text-xs">Chỉ số ({dr.metrics.length})</summary>
                        <ul className="mt-1.5 space-y-1 pl-2">
                          {dr.metrics.map((m) => {
                            const excluded = excludedMetrics.has(`${dr.departmentId}|${m.metricId}`);
                            return (
                              <li key={m.metricId} className={`flex items-center gap-2 text-xs ${excluded ? 'opacity-40 line-through' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={!excluded}
                                  onChange={() => toggleMetric(dr.departmentId, m.metricId)}
                                />
                                <span className="flex-1 text-slate-700">{m.metricName}</span>
                                <span className="font-mono text-slate-900 tabular-nums">{m.value?.toLocaleString('vi-VN')}</span>
                                <span className="text-xs text-slate-400 w-9 text-right tabular-nums">{(m.confidence * 100).toFixed(0)}%</span>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                    {dr.tasks.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-slate-700 text-xs">Nhiệm vụ ({dr.tasks.length})</summary>
                        <ul className="mt-1.5 space-y-2 pl-2">
                          {dr.tasks.map((t) => {
                            const excluded = excludedTasks.has(`${dr.departmentId}|${t.masterTaskId}`);
                            return (
                              <li key={t.masterTaskId} className={`flex gap-2 text-xs ${excluded ? 'opacity-40' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={!excluded}
                                  onChange={() => toggleTask(dr.departmentId, t.masterTaskId)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900">{t.taskName}</div>
                                  <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap line-clamp-3">{t.result}</div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                    {dr.newTasks.length > 0 && (
                      <details className="text-sm" open>
                        <summary className="cursor-pointer font-medium text-violet-700 text-xs flex items-center justify-between">
                          <span>🆕 Task mới đề xuất ({dr.newTasks.length})</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              addNewTasksToDb(
                                dr.departmentId,
                                dr.newTasks.map((nt) => nt.taskName),
                              );
                            }}
                            disabled={isAdding}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50"
                          >
                            {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            Thêm tất cả vào DB
                          </button>
                        </summary>
                        <ul className="mt-1.5 space-y-1 pl-2 text-xs text-slate-600">
                          {dr.newTasks.map((nt, i) => (
                            <li key={i} className="flex items-start justify-between gap-2 py-0.5">
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-violet-700">{nt.taskName}</span>
                                {nt.result && <span className="text-slate-500"> — {nt.result.slice(0, 150)}</span>}
                              </div>
                              <button
                                onClick={() => addNewTasksToDb(dr.departmentId, [nt.taskName])}
                                disabled={isAdding}
                                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 border border-violet-200 rounded hover:bg-violet-50 disabled:opacity-50"
                                title="Thêm task này vào DB"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                Thêm
                              </button>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-slate-400 mt-1 pl-2">
                          Sau khi thêm vào DB, các task này sẽ có sẵn để chọn từ tuần sau. Chạy lại phòng để map dữ liệu tuần này vào task vừa tạo.
                        </p>
                      </details>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'saving' && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 text-violet-600 animate-spin mx-auto mb-3" />
            <p className="text-slate-700 text-sm">Đang lưu vào tuần {weekNumber}/{year}...</p>
          </div>
        )}

        {phase === 'success' && savedWeekId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h3 className="font-semibold text-emerald-900">Đã lưu thành công!</h3>
            <p className="text-emerald-700 text-sm mt-0.5">Tuần {weekNumber}/{year} đã có trong hệ thống.</p>
            <div className="mt-3 flex gap-2 justify-center">
              <a
                href={`/dashboard/weeks/${savedWeekId}`}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg"
              >
                Xem báo cáo
              </a>
              <button
                onClick={() => {
                  setPhase('idle');
                  setResults([]);
                  setProgressEvents([]);
                  setSavedWeekId(null);
                  setExcludedTasks(new Set());
                  setExcludedMetrics(new Set());
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                Nhập tuần khác
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getCurrentISOWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
