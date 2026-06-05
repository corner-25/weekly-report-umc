'use client';

import { useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Sparkles, Upload, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet } from 'lucide-react';

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

export default function AiImportPage() {
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

  // Toggles per dept/task/metric for selective save
  const [excludedTasks, setExcludedTasks] = useState<Set<string>>(new Set()); // key = `${deptId}|${masterTaskId}`
  const [excludedMetrics, setExcludedMetrics] = useState<Set<string>>(new Set()); // key = `${deptId}|${metricId}`

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
    setResults([]);

    const form = new FormData();
    form.append('file', file);
    form.append('weekNumber', String(weekNumber));
    form.append('year', String(year));

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
            setProgressEvents((prev) => [...prev, obj as ProgressEvent]);
          } else if (lastEvent === 'complete') {
            setResults(obj.results as DeptResult[]);
            setPhase('review');
          } else if (lastEvent === 'error') {
            setErrorMsg(obj.error || 'Lỗi');
            setPhase('error');
          }
        } catch {
          /* ignore malformed */
        }
      }
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
  }

  const matchedCount = progressEvents.filter((p) => p.status === 'done').length;
  const totalCount = progressEvents[0]?.total ?? 0;
  const pct = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Nhập báo cáo tuần bằng AI"
        description="Upload file Excel — DeepSeek tự match nhiệm vụ và chỉ số, bạn review rồi lưu"
      />

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {errorMsg}
        </div>
      )}

      {phase === 'idle' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">File Excel báo cáo tuần *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
            />
            {file && (
              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" /> {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tuần *</label>
              <input
                type="number"
                min={1}
                max={53}
                value={weekNumber}
                onChange={(e) => setWeekNumber(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Năm *</label>
              <input
                type="number"
                min={2024}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Từ ngày *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Đến ngày *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
              />
            </div>
          </div>
          <button
            onClick={start}
            disabled={!file}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" /> Bắt đầu phân tích bằng AI
          </button>
        </div>
      )}

      {(phase === 'parsing' || phase === 'matching') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-5 h-5 text-cyan-600 animate-spin" />
            <h2 className="font-semibold text-slate-900">
              {phase === 'parsing' ? 'Đang đọc file...' : `Đang xử lý ${matchedCount}/${totalCount} phòng`}
            </h2>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto text-sm">
            {progressEvents.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  {p.status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : p.status === 'error' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : p.status === 'skipped' ? (
                    <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-cyan-500 animate-spin shrink-0" />
                  )}
                  <span className="truncate text-slate-700">{p.deptName}</span>
                </div>
                <div className="text-xs text-slate-500 shrink-0">
                  {p.status === 'done' && (
                    <span>{p.taskCount} task · {p.metricCount} metric{(p.newTaskCount ?? 0) > 0 ? ` · ${p.newTaskCount} mới` : ''}{(p.dormantTaskCount ?? 0) > 0 ? ` · ${p.dormantTaskCount} dormant` : ''}</span>
                  )}
                  {p.status === 'matching' && <span>AI đang phân tích...</span>}
                  {p.status === 'error' && <span>{p.error}</span>}
                  {p.status === 'skipped' && <span>bỏ qua ({p.reason})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Phân tích xong — Xem lại trước khi lưu</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {results.length} phòng · {results.reduce((s, r) => s + r.tasks.length, 0)} nhiệm vụ · {results.reduce((s, r) => s + r.metrics.length, 0)} chỉ số
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPhase('idle'); setResults([]); setProgressEvents([]); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={save}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl"
              >
                Lưu vào tuần {weekNumber}/{year}
              </button>
            </div>
          </div>
          {results.map((dr) => (
            <div key={dr.departmentId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <div className="font-semibold text-slate-900">{dr.departmentName}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {dr.tasks.length}/{dr.masterTaskCount} nhiệm vụ · {dr.metrics.length}/{dr.metricDefCount} chỉ số
                  {dr.newTasks.length > 0 && <> · <span className="text-violet-600">{dr.newTasks.length} task mới</span></>}
                  {dr.dormantTasks.length > 0 && <> · <span className="text-slate-500">{dr.dormantTasks.length} không hoạt động</span></>}
                  {dr.newMetrics.length > 0 && <> · <span className="text-violet-600">{dr.newMetrics.length} chỉ số mới</span></>}
                </div>
              </div>
              <div className="px-5 py-3 space-y-2.5">
                {dr.metrics.length > 0 && (
                  <details className="text-sm" open>
                    <summary className="cursor-pointer font-medium text-slate-700">Chỉ số ({dr.metrics.length})</summary>
                    <ul className="mt-1.5 space-y-1 pl-2">
                      {dr.metrics.map((m) => {
                        const excluded = excludedMetrics.has(`${dr.departmentId}|${m.metricId}`);
                        return (
                          <li key={m.metricId} className={`flex items-center gap-2 text-sm ${excluded ? 'opacity-40 line-through' : ''}`}>
                            <input
                              type="checkbox"
                              checked={!excluded}
                              onChange={() => toggleMetric(dr.departmentId, m.metricId)}
                            />
                            <span className="flex-1 text-slate-700">{m.metricName}</span>
                            <span className="font-mono text-slate-900">{m.value?.toLocaleString('vi-VN')}</span>
                            <span className="text-xs text-slate-400 w-10 text-right">{(m.confidence * 100).toFixed(0)}%</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
                {dr.tasks.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-slate-700">Nhiệm vụ ({dr.tasks.length})</summary>
                    <ul className="mt-1.5 space-y-2 pl-2">
                      {dr.tasks.map((t) => {
                        const excluded = excludedTasks.has(`${dr.departmentId}|${t.masterTaskId}`);
                        return (
                          <li key={t.masterTaskId} className={`flex gap-2 text-sm ${excluded ? 'opacity-40' : ''}`}>
                            <input
                              type="checkbox"
                              checked={!excluded}
                              onChange={() => toggleTask(dr.departmentId, t.masterTaskId)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{t.taskName}</div>
                              <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{t.result}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
                {dr.newTasks.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-violet-700">🆕 Task mới đề xuất ({dr.newTasks.length})</summary>
                    <ul className="mt-1.5 space-y-1 pl-2 text-xs text-slate-600">
                      {dr.newTasks.map((nt, i) => (
                        <li key={i}>
                          <span className="font-medium text-violet-700">{nt.taskName}</span>
                          {nt.result && <span className="text-slate-500"> — {nt.result.slice(0, 200)}</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-slate-400 mt-1 pl-2">Các task mới này KHÔNG được lưu — bạn tự thêm vào DB nếu muốn track.</p>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === 'saving' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Loader2 className="w-8 h-8 text-cyan-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-700">Đang lưu vào tuần {weekNumber}/{year}...</p>
        </div>
      )}

      {phase === 'success' && savedWeekId && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-emerald-900">Đã lưu thành công!</h2>
          <p className="text-emerald-700 mt-1">Tuần {weekNumber}/{year} đã có trong hệ thống.</p>
          <div className="mt-4 flex gap-2 justify-center">
            <a
              href={`/dashboard/weeks/${savedWeekId}`}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl"
            >
              Xem báo cáo
            </a>
            <button
              onClick={() => { setPhase('idle'); setResults([]); setProgressEvents([]); setSavedWeekId(null); }}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl"
            >
              Nhập tuần khác
            </button>
          </div>
        </div>
      )}
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
