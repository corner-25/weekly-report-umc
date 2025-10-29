'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getWeek, getYear, startOfWeek, endOfWeek, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import MetricsInput from '@/components/MetricsInput';

interface Department {
  id: string;
  name: string;
}

interface MasterTask {
  id: string;
  name: string;
  description: string | null;
  department: Department;
  latestProgress: number;
  weekCount: number;
}

interface TaskProgress {
  id?: string;
  masterTaskId?: string;
  taskName?: string;
  orderNumber: number;
  result: string;
  timePeriod: string;
  progress: number;
  nextWeekPlan: string;
  isImportant: boolean;
}

interface AdHocTask {
  id?: string;
  departmentId: string;
  orderNumber: number;
  taskName: string;
  result: string;
  timePeriod: string;
  progress: number;
  nextWeekPlan: string;
  isImportant: boolean;
}

interface DepartmentData {
  departmentId: string;
  taskProgress: TaskProgress[];
  adHocTasks: AdHocTask[];
}

export default function EditWeekReport({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [masterTasks, setMasterTasks] = useState<MasterTask[]>([]);
  const [allMetrics, setAllMetrics] = useState<any[]>([]); // For filtering metric values by department

  const [weekId, setWeekId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekNumber, setWeekNumber] = useState(0);
  const [year, setYear] = useState(0);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportFileUrl, setReportFileUrl] = useState<string | null>(null);

  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [currentDeptId, setCurrentDeptId] = useState<string>('');
  const [metricValues, setMetricValues] = useState<any[]>([]);

  useEffect(() => {
    fetchDepartments();
    fetchMasterTasks();
    fetchMetrics();
    fetchWeek();
  }, []);

  useEffect(() => {
    const wn = getWeek(selectedDate, { locale: vi });
    const y = getYear(selectedDate);
    const start = startOfWeek(selectedDate, { locale: vi, weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { locale: vi, weekStartsOn: 1 });

    setWeekNumber(wn);
    setYear(y);
    setStartDate(start);
    setEndDate(end);
  }, [selectedDate]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchMasterTasks = async () => {
    try {
      const response = await fetch('/api/master-tasks');
      if (response.ok) {
        const data = await response.json();
        setMasterTasks(data);
      }
    } catch (error) {
      console.error('Error fetching master tasks:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics');
      if (response.ok) {
        const data = await response.json();
        setAllMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchWeek = async () => {
    try {
      const response = await fetch(`/api/weeks/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();

        setWeekId(data.id);
        setWeekNumber(data.weekNumber);
        setYear(data.year);
        setStartDate(new Date(data.startDate));
        setEndDate(new Date(data.endDate));
        setReportFileUrl(data.reportFileUrl);
        setSelectedDate(new Date(data.startDate));

        // Group data by department
        const grouped: { [key: string]: DepartmentData } = {};

        // Load WeekTaskProgress (Master Tasks)
        data.taskProgress?.forEach((tp: any) => {
          const deptId = tp.masterTask.department.id;
          if (!grouped[deptId]) {
            grouped[deptId] = {
              departmentId: deptId,
              taskProgress: [],
              adHocTasks: [],
            };
          }
          grouped[deptId].taskProgress.push({
            id: tp.id,
            masterTaskId: tp.masterTaskId,
            orderNumber: tp.orderNumber,
            result: tp.result,
            timePeriod: tp.timePeriod,
            progress: tp.progress,
            nextWeekPlan: tp.nextWeekPlan,
            isImportant: tp.isImportant,
          });
        });

        // Load old Tasks (Ad-hoc tasks)
        data.tasks?.forEach((task: any) => {
          const deptId = task.departmentId;
          if (!grouped[deptId]) {
            grouped[deptId] = {
              departmentId: deptId,
              taskProgress: [],
              adHocTasks: [],
            };
          }
          grouped[deptId].adHocTasks.push({
            id: task.id,
            departmentId: task.departmentId,
            orderNumber: task.orderNumber,
            taskName: task.taskName,
            result: task.result,
            timePeriod: task.timePeriod,
            progress: task.progress,
            nextWeekPlan: task.nextWeekPlan,
            isImportant: task.isImportant,
          });
        });

        setDepartmentData(Object.values(grouped));
      }
    } catch (error) {
      console.error('Error fetching week:', error);
      setError('Không thể tải báo cáo');
    } finally {
      setPageLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReportFile(file);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setReportFileUrl(data.url);
      } else {
        setError('Không thể upload file');
      }
    } catch (error) {
      setError('Lỗi khi upload file');
    }
  };

  const removeFile = () => {
    setReportFile(null);
    setReportFileUrl(null);
  };

  const addDepartment = () => {
    if (!currentDeptId) return;

    const exists = departmentData.find((d) => d.departmentId === currentDeptId);
    if (exists) {
      setError('Phòng này đã được thêm');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setDepartmentData([
      ...departmentData,
      {
        departmentId: currentDeptId,
        taskProgress: [],
        adHocTasks: [],
      },
    ]);
    setCurrentDeptId('');
  };

  const removeDepartment = (departmentId: string) => {
    if (!confirm('Bạn có chắc muốn xóa phòng này?')) return;
    setDepartmentData(departmentData.filter((d) => d.departmentId !== departmentId));
  };

  // Master Task Progress functions
  const addMasterTaskProgress = (departmentId: string, masterTaskId: string) => {
    setDepartmentData(
      departmentData.map((d) => {
        if (d.departmentId === departmentId) {
          const exists = d.taskProgress.find((tp) => tp.masterTaskId === masterTaskId);
          if (exists) {
            setError('Nhiệm vụ này đã được thêm');
            setTimeout(() => setError(''), 3000);
            return d;
          }

          const nextOrder = d.taskProgress.length + d.adHocTasks.length + 1;
          return {
            ...d,
            taskProgress: [
              ...d.taskProgress,
              {
                masterTaskId,
                orderNumber: nextOrder,
                result: '',
                timePeriod: '',
                progress: 0,
                nextWeekPlan: '',
                isImportant: false,
              },
            ],
          };
        }
        return d;
      })
    );
  };

  const updateTaskProgress = (
    departmentId: string,
    index: number,
    field: keyof TaskProgress,
    value: any
  ) => {
    setDepartmentData(
      departmentData.map((d) => {
        if (d.departmentId === departmentId) {
          const newTaskProgress = [...d.taskProgress];
          newTaskProgress[index] = { ...newTaskProgress[index], [field]: value };
          return { ...d, taskProgress: newTaskProgress };
        }
        return d;
      })
    );
  };

  const removeTaskProgress = (departmentId: string, index: number) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;
    setDepartmentData(
      departmentData.map((d) => {
        if (d.departmentId === departmentId) {
          const newTaskProgress = d.taskProgress.filter((_, i) => i !== index);
          return { ...d, taskProgress: newTaskProgress };
        }
        return d;
      })
    );
  };

  // Ad-hoc Task functions
  const addAdHocTask = (departmentId: string) => {
    setDepartmentData(
      departmentData.map((d) => {
        if (d.departmentId === departmentId) {
          const nextOrder = d.taskProgress.length + d.adHocTasks.length + 1;
          return {
            ...d,
            adHocTasks: [
              ...d.adHocTasks,
              {
                departmentId,
                orderNumber: nextOrder,
                taskName: '',
                result: '',
                timePeriod: '',
                progress: 0,
                nextWeekPlan: '',
                isImportant: false,
              },
            ],
          };
        }
        return d;
      })
    );
  };

  const updateAdHocTask = (
    departmentId: string,
    index: number,
    field: keyof AdHocTask,
    value: any
  ) => {
    setDepartmentData(
      departmentData.map((d) => {
        if (d.departmentId === departmentId) {
          const newAdHocTasks = [...d.adHocTasks];
          newAdHocTasks[index] = { ...newAdHocTasks[index], [field]: value };
          return { ...d, adHocTasks: newAdHocTasks };
        }
        return d;
      })
    );
  };

  const removeAdHocTask = (departmentId: string, index: number) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;
    setDepartmentData(
      departmentData.map((d) => {
        if (d.departmentId === departmentId) {
          const newAdHocTasks = d.adHocTasks.filter((_, i) => i !== index);
          return { ...d, adHocTasks: newAdHocTasks };
        }
        return d;
      })
    );
  };

  const handleSubmit = async (submitStatus: 'DRAFT' | 'COMPLETED') => {
    setError('');
    setLoading(true);

    if (departmentData.length === 0) {
      setError('Phải có ít nhất 1 phòng');
      setLoading(false);
      return;
    }

    const allTaskProgress = departmentData.flatMap((d) => d.taskProgress);
    const allAdHocTasks = departmentData.flatMap((d) => d.adHocTasks);

    if (allTaskProgress.length === 0 && allAdHocTasks.length === 0) {
      setError('Phải có ít nhất 1 nhiệm vụ');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/weeks/${weekId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          weekNumber,
          year,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reportFileUrl,
          status: submitStatus,
          taskProgress: allTaskProgress,
          tasks: allAdHocTasks,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Có lỗi xảy ra');
      } else {
        // Save metric values if any
        if (metricValues.length > 0) {
          const metricPromises = metricValues.map((value) =>
            fetch('/api/week-metrics', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...value,
                weekId,
              }),
            })
          );
          await Promise.all(metricPromises);
        }
        router.push('/dashboard');
      }
    } catch (error) {
      setError('Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const getMasterTaskById = (id: string) => {
    return masterTasks.find((mt) => mt.id === id);
  };

  if (pageLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          &larr; Quay lại
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Chỉnh sửa Báo cáo Tuần {weekNumber}/{year}</h1>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Week Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Thông tin tuần</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn ngày trong tuần
            </label>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Tuần:</strong> {weekNumber} / {year}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Từ ngày:</strong> {format(startDate, 'dd/MM/yyyy', { locale: vi })}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Đến ngày:</strong> {format(endDate, 'dd/MM/yyyy', { locale: vi })}
            </p>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">File biên bản (Tùy chọn)</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            id="file-upload"
            accept=".pdf,.xlsx,.xls,.docx,.doc"
            onChange={handleFileUpload}
            className="hidden"
          />
          {reportFileUrl || reportFile ? (
            <div className="space-y-2">
              <div className="text-green-600">
                {reportFile?.name || reportFileUrl?.split('/').pop()}
              </div>
              <button
                onClick={removeFile}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Xóa file
              </button>
            </div>
          ) : (
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-gray-500">
                <p>Kéo thả file vào đây hoặc click để chọn</p>
                <p className="text-sm mt-2">Hỗ trợ: PDF, Excel, Word</p>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Department Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Chọn phòng ban</h2>
        <div className="flex gap-4">
          <select
            value={currentDeptId}
            onChange={(e) => setCurrentDeptId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Chọn phòng --</option>
            {departments
              .filter((d) => !departmentData.find((dd) => dd.departmentId === d.id))
              .map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
          </select>
          <button
            onClick={addDepartment}
            disabled={!currentDeptId}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Thêm phòng
          </button>
        </div>
      </div>

      {/* Department Data - Same as New page */}
      {departmentData.map((deptData) => {
        const dept = departments.find((d) => d.id === deptData.departmentId);
        const deptMasterTasks = masterTasks.filter((mt) => mt.department.id === deptData.departmentId);
        const availableTasks = deptMasterTasks.filter(
          (mt) => !deptData.taskProgress.find((tp) => tp.masterTaskId === mt.id)
        );

        return (
          <div key={deptData.departmentId} className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{dept?.name}</h3>
              <button
                onClick={() => removeDepartment(deptData.departmentId)}
                className="text-red-600 hover:text-red-800"
              >
                Xóa phòng
              </button>
            </div>

            {/* Master Tasks Section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">Nhiệm vụ thường kỳ</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Công việc định kỳ, lặp lại hàng tuần</p>
                </div>
              </div>

              {availableTasks.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chọn nhiệm vụ thường kỳ từ danh sách:
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addMasterTaskProgress(deptData.departmentId, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Chọn nhiệm vụ --</option>
                    {availableTasks.map((mt) => (
                      <option key={mt.id} value={mt.id}>
                        {mt.name} (Tiến độ tuần trước: {mt.latestProgress}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {deptData.taskProgress.map((tp, index) => {
                const masterTask = getMasterTaskById(tp.masterTaskId!);
                return (
                  <div key={index} className="border-2 border-blue-200 rounded-lg p-4 mb-4 bg-blue-50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h5 className="font-bold text-blue-900">#{tp.orderNumber}. {masterTask?.name}</h5>
                        {masterTask?.description && (
                          <p className="text-xs text-gray-600 mt-1">{masterTask.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateTaskProgress(deptData.departmentId, index, 'isImportant', !tp.isImportant)
                          }
                          className={`p-1.5 rounded transition-colors ${
                            tp.isImportant
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title="Đánh dấu quan trọng"
                        >
                          <svg className="w-5 h-5" fill={tp.isImportant ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeTaskProgress(deptData.departmentId, index)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Xóa"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kết quả thực hiện tuần này *
                        </label>
                        <textarea
                          value={tp.result}
                          onChange={(e) =>
                            updateTaskProgress(deptData.departmentId, index, 'result', e.target.value)
                          }
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian *</label>
                          <input
                            type="text"
                            value={tp.timePeriod}
                            onChange={(e) =>
                              updateTaskProgress(deptData.departmentId, index, 'timePeriod', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tiến độ (%) <span className="text-gray-400 text-xs font-normal">(Tùy chọn)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={tp.progress ?? ''}
                            onChange={(e) =>
                              updateTaskProgress(deptData.departmentId, index, 'progress', e.target.value ? parseInt(e.target.value) : null)
                            }
                            placeholder="Bỏ trống nếu không có tiến độ"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kế hoạch tuần sau *
                        </label>
                        <textarea
                          value={tp.nextWeekPlan}
                          onChange={(e) =>
                            updateTaskProgress(deptData.departmentId, index, 'nextWeekPlan', e.target.value)
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ad-hoc Tasks Section */}
            <div className="mb-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">Nhiệm vụ phát sinh</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Công việc đột xuất, không định kỳ</p>
                </div>
                <button
                  onClick={() => addAdHocTask(deptData.departmentId)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  + Thêm nhiệm vụ
                </button>
              </div>

              {deptData.adHocTasks.map((task, index) => (
                <div key={index} className="border-2 border-green-200 rounded-lg p-4 mb-4 bg-green-50">
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="font-bold text-green-900">Nhiệm vụ #{task.orderNumber}</h5>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          updateAdHocTask(deptData.departmentId, index, 'isImportant', !task.isImportant)
                        }
                        className={`p-1.5 rounded transition-colors ${
                          task.isImportant
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title="Đánh dấu quan trọng"
                      >
                        <svg className="w-5 h-5" fill={task.isImportant ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeAdHocTask(deptData.departmentId, index)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Xóa"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhiệm vụ *</label>
                      <textarea
                        value={task.taskName}
                        onChange={(e) =>
                          updateAdHocTask(deptData.departmentId, index, 'taskName', e.target.value)
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kết quả *</label>
                      <textarea
                        value={task.result}
                        onChange={(e) =>
                          updateAdHocTask(deptData.departmentId, index, 'result', e.target.value)
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian *</label>
                        <input
                          type="text"
                          value={task.timePeriod}
                          onChange={(e) =>
                            updateAdHocTask(deptData.departmentId, index, 'timePeriod', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tiến độ (%) <span className="text-gray-400 text-xs font-normal">(Tùy chọn)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={task.progress ?? ''}
                          onChange={(e) =>
                            updateAdHocTask(deptData.departmentId, index, 'progress', e.target.value ? parseInt(e.target.value) : null)
                          }
                          placeholder="Bỏ trống nếu không có tiến độ"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kế hoạch tuần sau *
                      </label>
                      <textarea
                        value={task.nextWeekPlan}
                        onChange={(e) =>
                          updateAdHocTask(deptData.departmentId, index, 'nextWeekPlan', e.target.value)
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Metrics Input for this department */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <MetricsInput
                weekId={weekId}
                departmentId={deptData.departmentId}
                onChange={(values) => {
                  // Update metric values for this department
                  setMetricValues(prev => {
                    // Remove old values for this department
                    const filtered = prev.filter(v => {
                      const metric = allMetrics.find(m => m.id === v.metricId);
                      return metric?.department?.id !== deptData.departmentId;
                    });
                    // Add new values
                    return [...filtered, ...values];
                  });
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Submit Buttons */}
      <div className="flex gap-4 justify-end mb-8">
        <button
          onClick={() => handleSubmit('DRAFT')}
          disabled={loading}
          className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          Lưu nháp
        </button>
        <button
          onClick={() => handleSubmit('COMPLETED')}
          disabled={loading}
          className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Hoàn thành & Lưu
        </button>
      </div>
    </div>
  );
}
