'use client';

import { useEffect, useState } from 'react';

interface Department {
  id: string;
  name: string;
}

interface MasterTask {
  id: string;
  name: string;
  description: string | null;
  estimatedDuration: number | null;
  startDate: string | null;
  endDate: string | null;
  department: Department;
  latestProgress: number;
  isCompleted: boolean;
  weekCount: number;
  createdAt: string;
}

export default function MasterTasksPage() {
  const [tasks, setTasks] = useState<MasterTask[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingTask, setEditingTask] = useState<MasterTask | null>(null);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<any>(null);
  const [filterDept, setFilterDept] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    departmentId: '',
    name: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartments();
    fetchTasks();
  }, [filterDept]);

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

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDept) {
        params.append('departmentId', filterDept);
      }

      const response = await fetch(`/api/master-tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTask(null);
    setFormData({
      departmentId: '',
      name: '',
      description: '',
      startDate: '',
      endDate: '',
    });
    setError('');
    setShowModal(true);
  };

  const handleEdit = (task: MasterTask) => {
    setEditingTask(task);
    setFormData({
      departmentId: task.department.id,
      name: task.name,
      description: task.description || '',
      startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
      endDate: task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate dates
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) {
        setError('Ngày kết thúc phải sau ngày bắt đầu');
        return;
      }
    }

    try {
      const url = editingTask
        ? `/api/master-tasks/${editingTask.id}`
        : '/api/master-tasks';
      const method = editingTask ? 'PUT' : 'POST';

      const body: any = {
        name: formData.name,
        description: formData.description || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
      };

      if (!editingTask) {
        body.departmentId = formData.departmentId;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Có lỗi xảy ra');
      } else {
        setShowModal(false);
        fetchTasks();
      }
    } catch (error) {
      setError('Có lỗi xảy ra');
    }
  };

  const handleDelete = async (task: MasterTask) => {
    if (
      !confirm(
        `Bạn có chắc muốn xóa nhiệm vụ "${task.name}"?\n\nLưu ý: Chỉ xóa được nếu chưa có tiến độ nào.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/master-tasks/${task.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Có lỗi xảy ra');
      } else {
        fetchTasks();
      }
    } catch (error) {
      alert('Có lỗi xảy ra');
    }
  };

  const handleViewHistory = async (task: MasterTask) => {
    try {
      const response = await fetch(`/api/master-tasks/${task.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTaskHistory(data);
        setShowHistoryModal(true);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const filteredTasks = tasks.filter((task) =>
    task.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Danh sách Nhiệm vụ Thường kỳ
          </h1>
          <p className="text-gray-600 mt-2 text-sm">
            Quản lý các nhiệm vụ định kỳ, lặp lại hàng tuần của từng phòng ban
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          + Thêm nhiệm vụ thường kỳ
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tìm kiếm
            </label>
            <input
              type="text"
              placeholder="Tên nhiệm vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lọc theo phòng
            </label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tất cả phòng</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Đang tải...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">Chưa có nhiệm vụ thường kỳ nào</p>
          <button
            onClick={handleAdd}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Tạo nhiệm vụ thường kỳ đầu tiên
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên nhiệm vụ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phòng ban
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tiến độ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số tuần
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {task.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {task.department.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-2" style={{ width: '100px' }}>
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${task.latestProgress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-700">
                        {task.latestProgress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.weekCount} tuần
                    {task.startDate && task.endDate && (
                      <span className="text-gray-400">
                        {' '}
                        / {Math.ceil(
                          (new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) /
                          (7 * 24 * 60 * 60 * 1000)
                        )}
                      </span>
                    )}
                    {task.startDate && task.endDate && (
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(task.startDate).toLocaleDateString('vi-VN')} - {new Date(task.endDate).toLocaleDateString('vi-VN')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {task.isCompleted ? (
                      <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded">
                        Hoàn thành
                      </span>
                    ) : task.weekCount > 0 ? (
                      <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded">
                        Đang làm
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 rounded">
                        Chưa bắt đầu
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewHistory(task)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="Xem lịch sử"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEdit(task)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Chỉnh sửa"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(task)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Xóa"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingTask ? 'Sửa nhiệm vụ thường kỳ' : 'Thêm nhiệm vụ thường kỳ mới'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {!editingTask && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phòng ban *
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) =>
                      setFormData({ ...formData, departmentId: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Chọn phòng --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên nhiệm vụ *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="VD: Xây dựng tiêu chuẩn chất lượng lâm sàng"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Mô tả chi tiết nhiệm vụ..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {formData.startDate && formData.endDate && (
                <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Số tuần dự kiến:</strong>{' '}
                    {Math.ceil(
                      (new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) /
                      (7 * 24 * 60 * 60 * 1000)
                    )}{' '}
                    tuần
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedTaskHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Lịch sử: {selectedTaskHistory.name}
              </h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Phòng:</strong> {selectedTaskHistory.department.name}
              </p>
              {selectedTaskHistory.description && (
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Mô tả:</strong> {selectedTaskHistory.description}
                </p>
              )}
            </div>

            <h3 className="font-bold mb-3">Tiến độ theo tuần:</h3>

            {selectedTaskHistory.weekProgress.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Chưa có tiến độ nào được ghi nhận
              </p>
            ) : (
              <div className="space-y-3">
                {selectedTaskHistory.weekProgress.map((progress: any) => (
                  <div
                    key={progress.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold">
                          Tuần {progress.week.weekNumber}/{progress.week.year}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({new Date(progress.week.startDate).toLocaleDateString('vi-VN')} -{' '}
                          {new Date(progress.week.endDate).toLocaleDateString('vi-VN')})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {progress.isImportant && (
                          <span className="px-2 py-0.5 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded">
                            Quan trọng
                          </span>
                        )}
                        <div className="flex items-center">
                          <div
                            className="w-24 bg-gray-200 rounded-full h-2 mr-2"
                          >
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${progress.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold">
                            {progress.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>
                        <strong>Kết quả:</strong> {progress.result}
                      </p>
                      <p>
                        <strong>Thời gian:</strong> {progress.timePeriod}
                      </p>
                      <p>
                        <strong>Kế hoạch tuần sau:</strong> {progress.nextWeekPlan}
                      </p>
                      {progress.completedAt && (
                        <p className="text-green-600">
                          <strong>✓ Hoàn thành:</strong>{' '}
                          {new Date(progress.completedAt).toLocaleDateString('vi-VN')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
