'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseExcelFile, type ParsedWeekData } from '@/lib/excel-parser';
import { matchTasksToMaster, type MatchResult, type MasterTaskRef, type MatchedTask } from '@/lib/task-matcher';
import { extractMetrics, type MetricDefinitionRef, type ExtractedMetric } from '@/lib/metric-extractor';

interface ReferenceData {
  departments: { id: string; name: string }[];
  masterTasks: MasterTaskRef[];
  metricDefinitions: MetricDefinitionRef[];
}

type Step = 'upload' | 'preview' | 'submit';

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refData, setRefData] = useState<ReferenceData | null>(null);

  // Upload step
  const [fileName, setFileName] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState<number>(0);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Preview step
  const [parsedData, setParsedData] = useState<ParsedWeekData | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [extractedMetrics, setExtractedMetrics] = useState<ExtractedMetric[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'metrics'>('tasks');
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Submit step
  const [submitResult, setSubmitResult] = useState<{ message: string; weekId: string } | null>(null);

  // Fetch reference data on mount
  useEffect(() => {
    fetch('/api/import')
      .then(res => res.json())
      .then(data => setRefData(data))
      .catch(err => setError('Không thể tải dữ liệu tham chiếu: ' + err.message));
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelFile(buffer);
      setParsedData(parsed);

      if (!refData) {
        setError('Chưa tải xong dữ liệu tham chiếu, vui lòng thử lại');
        return;
      }

      // Match tasks
      const matched = matchTasksToMaster(parsed.departments, refData.masterTasks, refData.departments);
      setMatchResult(matched);

      // Extract metrics
      const deptResults = new Map<string, string[]>();
      for (const dept of matched.departments) {
        if (dept.departmentId) {
          deptResults.set(
            dept.departmentId,
            dept.tasks.map(t => t.result)
          );
        }
      }
      const metrics = extractMetrics(deptResults, refData.metricDefinitions);
      setExtractedMetrics(metrics);

      // Auto-expand all departments
      setExpandedDepts(new Set(matched.departments.map(d => d.departmentName)));

      setStep('preview');
    } catch (err) {
      setError('Lỗi đọc file: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [refData]);

  const handleSubmit = async () => {
    if (!matchResult || !weekNumber || !year || !startDate || !endDate) {
      setError('Vui lòng điền đầy đủ thông tin tuần');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Collect matched tasks only
      const taskProgress = matchResult.departments
        .flatMap(dept => dept.tasks)
        .filter(t => t.masterTaskId)
        .map((t, i) => ({
          masterTaskId: t.masterTaskId!,
          orderNumber: i + 1,
          result: t.result || '',
          timePeriod: t.timePeriod || '',
          progress: t.progress,
          nextWeekPlan: '',
          isImportant: t.isImportant,
        }));

      // Collect extracted metrics with values
      const metricValues = extractedMetrics
        .filter(m => m.value !== null && m.confidence !== 'missing')
        .map(m => ({
          metricId: m.metricId,
          value: m.value!,
          note: m.note,
        }));

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekNumber,
          year,
          startDate,
          endDate,
          taskProgress,
          metricValues,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Có lỗi xảy ra');
      }

      setSubmitResult(result);
      setStep('submit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const toggleDept = (name: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Manual metric value editing
  const updateMetricValue = (metricId: string, value: number | null) => {
    setExtractedMetrics(prev =>
      prev.map(m =>
        m.metricId === metricId
          ? { ...m, value, confidence: value !== null ? 'exact' : 'missing' as const }
          : m
      )
    );
  };

  // Manual task matching: change which masterTask a parsed task points to
  const updateTaskMatch = (deptName: string, taskIdx: number, masterTaskId: string | null) => {
    if (!matchResult || !refData) return;
    setMatchResult(prev => {
      if (!prev) return prev;
      const newDepts = prev.departments.map(dept => {
        if (dept.departmentName !== deptName) return dept;
        const newTasks = dept.tasks.map((t, i) => {
          if (i !== taskIdx) return t;
          if (!masterTaskId) {
            return { ...t, masterTaskId: null, masterTaskName: null, matchConfidence: 'none' as const };
          }
          const mt = refData.masterTasks.find(m => m.id === masterTaskId);
          return {
            ...t,
            masterTaskId,
            masterTaskName: mt?.name ?? null,
            matchConfidence: 'exact' as const,
          };
        });
        return { ...dept, tasks: newTasks };
      });

      const matchedTasks = newDepts.flatMap(d => d.tasks).filter(t => t.masterTaskId).length;
      const totalTasks = newDepts.flatMap(d => d.tasks).length;

      return {
        ...prev,
        departments: newDepts,
        stats: {
          ...prev.stats,
          matchedTasks,
          unmatchedTasks: totalTasks - matchedTasks,
        },
      };
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Dữ Liệu Tuần</h1>

      {/* Steps indicator */}
      <div className="flex items-center mb-8">
        {(['upload', 'preview', 'submit'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
              step === s ? 'bg-cyan-500 text-white' :
              (['upload', 'preview', 'submit'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {(['upload', 'preview', 'submit'].indexOf(step) > i) ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              ) : i + 1}
            </div>
            <span className={`ml-2 text-sm ${step === s ? 'text-cyan-700 font-medium' : 'text-gray-500'}`}>
              {s === 'upload' ? 'Tải file' : s === 'preview' ? 'Xem trước' : 'Hoàn tất'}
            </span>
            {i < 2 && <div className="w-12 h-px bg-gray-300 mx-3" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Thông tin tuần</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tuần</label>
              <input
                type="number"
                min={1}
                max={53}
                value={weekNumber || ''}
                onChange={e => setWeekNumber(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="VD: 10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Năm</label>
              <input
                type="number"
                min={2000}
                value={year}
                onChange={e => setYear(parseInt(e.target.value) || 2026)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-4">Tải file báo cáo</h2>

          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/30 transition-all">
            <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600">
              {fileName ? (
                <span className="text-cyan-600 font-medium">{fileName}</span>
              ) : (
                <>Kéo thả hoặc <span className="text-cyan-600 font-medium">chọn file Excel</span></>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-1">Hỗ trợ .xlsx, .xls</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {!refData && (
            <p className="text-sm text-gray-500 mt-3 flex items-center">
              <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" /><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              Đang tải dữ liệu tham chiếu...
            </p>
          )}
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 'preview' && matchResult && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Phòng ban" value={matchResult.stats.matchedDepartments} total={matchResult.departments.length} color="blue" />
            <StatCard label="Nhiệm vụ khớp" value={matchResult.stats.matchedTasks} total={matchResult.stats.totalTasks} color="green" />
            <StatCard label="NV chưa khớp" value={matchResult.stats.unmatchedTasks} color="red" />
            <StatCard label="Metrics có giá trị" value={extractedMetrics.filter(m => m.value !== null).length} total={extractedMetrics.length} color="purple" />
            <StatCard label="File" value={parsedData?.rawRowCount ?? 0} suffix=" dòng" color="gray" />
          </div>

          {/* Week info edit */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tuần</label>
                <input type="number" min={1} max={53} value={weekNumber || ''} onChange={e => setWeekNumber(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Năm</label>
                <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || 2026)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Từ ngày</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Đến ngày</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'tasks' ? 'bg-white shadow text-cyan-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Nhiệm vụ ({matchResult.stats.totalTasks})
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'metrics' ? 'bg-white shadow text-cyan-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Số liệu ({extractedMetrics.length})
            </button>
          </div>

          {/* Tasks tab */}
          {activeTab === 'tasks' && (
            <div className="space-y-3">
              {matchResult.departments.map(dept => (
                <div key={dept.departmentName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleDept(dept.departmentName)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`w-2 h-2 rounded-full ${dept.departmentId ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="font-medium text-sm text-gray-900">{dept.departmentName}</span>
                      {dept.matchedName && dept.matchedName !== dept.departmentName && (
                        <span className="text-xs text-gray-400">= {dept.matchedName}</span>
                      )}
                      <span className="text-xs text-gray-400">{dept.tasks.length} NV</span>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedDepts.has(dept.departmentName) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expandedDepts.has(dept.departmentName) && (
                    <div className="border-t border-gray-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-xs">
                            <th className="px-3 py-2 text-left w-8">#</th>
                            <th className="px-3 py-2 text-left">Nhiệm vụ (Excel)</th>
                            <th className="px-3 py-2 text-left w-64">Khớp với NV trong DB</th>
                            <th className="px-3 py-2 text-left w-16">Tiến độ</th>
                            <th className="px-3 py-2 text-center w-20">Độ khớp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dept.tasks.map((task, idx) => (
                            <TaskRow
                              key={idx}
                              task={task}
                              deptId={dept.departmentId}
                              masterTasks={refData?.masterTasks.filter(mt => mt.departmentId === dept.departmentId) ?? []}
                              onChangeMatch={(mtId) => updateTaskMatch(dept.departmentName, idx, mtId)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Metrics tab */}
          {activeTab === 'metrics' && (
            <MetricsPreview
              metrics={extractedMetrics}
              onUpdateValue={updateMetricValue}
            />
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => { setStep('upload'); setMatchResult(null); setParsedData(null); setFileName(''); }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Quay lại
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !weekNumber || !startDate || !endDate}
              className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" /><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  Đang nộp...
                </span>
              ) : (
                `Nộp báo cáo tuần ${weekNumber || '?'}/${year}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Submit result */}
      {step === 'submit' && submitResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{submitResult.message}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {matchResult?.stats.matchedTasks} nhiệm vụ, {extractedMetrics.filter(m => m.value !== null).length} chỉ số
          </p>
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={() => router.push(`/dashboard/weeks`)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Xem danh sách tuần
            </button>
            <button
              onClick={() => {
                setStep('upload');
                setMatchResult(null);
                setParsedData(null);
                setFileName('');
                setSubmitResult(null);
                setWeekNumber(0);
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg hover:from-cyan-600 hover:to-blue-600"
            >
              Import tuần khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StatCard({ label, value, total, suffix, color }: {
  label: string;
  value: number;
  total?: number;
  suffix?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-50 text-gray-700',
  };
  return (
    <div className={`rounded-xl p-3 ${colorMap[color] || colorMap.gray}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-lg font-bold">
        {value}{total !== undefined ? <span className="text-sm font-normal opacity-60">/{total}</span> : null}
        {suffix && <span className="text-sm font-normal">{suffix}</span>}
      </p>
    </div>
  );
}

function TaskRow({ task, deptId, masterTasks, onChangeMatch }: {
  task: MatchedTask;
  deptId: string | null;
  masterTasks: MasterTaskRef[];
  onChangeMatch: (mtId: string | null) => void;
}) {
  const confidenceColors: Record<string, string> = {
    exact: 'bg-green-100 text-green-700',
    high: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-orange-100 text-orange-700',
    none: 'bg-red-100 text-red-700',
  };
  const confidenceLabels: Record<string, string> = {
    exact: 'Chính xác',
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp',
    none: 'Chưa khớp',
  };

  return (
    <tr className="border-t border-gray-50 hover:bg-gray-50/50">
      <td className="px-3 py-2 text-gray-400">{task.orderNumber}</td>
      <td className="px-3 py-2">
        <p className="text-gray-900 font-medium text-xs leading-tight">{task.taskName}</p>
        {task.result && (
          <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{task.result.substring(0, 150)}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <select
          value={task.masterTaskId || ''}
          onChange={e => onChangeMatch(e.target.value || null)}
          className={`w-full text-xs px-2 py-1.5 rounded border ${
            task.masterTaskId ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
          }`}
        >
          <option value="">-- Chưa khớp --</option>
          {masterTasks.map(mt => (
            <option key={mt.id} value={mt.id}>{mt.name}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-center">
        {task.progress !== null ? (
          <span className={`text-xs font-medium ${task.progress === 100 ? 'text-green-600' : 'text-blue-600'}`}>
            {task.progress}%
          </span>
        ) : (
          <span className="text-xs text-gray-300">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColors[task.matchConfidence]}`}>
          {confidenceLabels[task.matchConfidence]}
        </span>
      </td>
    </tr>
  );
}

function MetricsPreview({ metrics, onUpdateValue }: {
  metrics: ExtractedMetric[];
  onUpdateValue: (metricId: string, value: number | null) => void;
}) {
  // Group by department
  const byDept = new Map<string, ExtractedMetric[]>();
  for (const m of metrics) {
    const list = byDept.get(m.departmentName) || [];
    list.push(m);
    byDept.set(m.departmentName, list);
  }

  return (
    <div className="space-y-3">
      {Array.from(byDept.entries()).map(([deptName, deptMetrics]) => (
        <div key={deptName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="font-medium text-sm text-gray-900">{deptName}</span>
            <span className="text-xs text-gray-400 ml-2">
              {deptMetrics.filter(m => m.value !== null).length}/{deptMetrics.length} giá trị
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs">
                <th className="px-3 py-2 text-left">Chỉ số</th>
                <th className="px-3 py-2 text-right w-40">Giá trị</th>
                <th className="px-3 py-2 text-center w-20">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {deptMetrics.map(m => (
                <tr key={m.metricId} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-2 text-gray-700 text-xs">{m.metricName}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={m.value ?? ''}
                      onChange={e => {
                        const v = e.target.value === '' ? null : parseFloat(e.target.value);
                        onUpdateValue(m.metricId, v);
                      }}
                      className="w-full text-right text-xs px-2 py-1 border border-gray-200 rounded"
                      placeholder="Nhập giá trị"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {m.confidence === 'exact' && <span className="text-xs text-green-600">Tự động</span>}
                    {m.confidence === 'extracted' && <span className="text-xs text-yellow-600">Trích xuất</span>}
                    {m.confidence === 'missing' && <span className="text-xs text-gray-400">Trống</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
