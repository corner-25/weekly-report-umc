'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

interface Event {
  id: string;
  date: string;
  time: string | null;
  location: string | null;
  content: string;
  chair: string | null;
  participants: string | null;
  note: string | null;
}

type ViewMode = 'table' | 'calendar';

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      // Get Monday of selected week
      const monday = new Date(selectedWeek);
      monday.setDate(monday.getDate() - monday.getDay() + 1);

      // Get Sunday of selected week
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      const startDate = monday.toISOString().split('T')[0];
      const endDate = sunday.toISOString().split('T')[0];

      const response = await fetch(`/api/events?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [selectedWeek]);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setEvents(events.filter(e => e.id !== id));
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Không thể xóa sự kiện');
    }
  };

  const getWeekDates = () => {
    const monday = new Date(selectedWeek);
    monday.setDate(monday.getDate() - monday.getDay() + 1);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const weekDayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const filtered = events.filter(e => e.date.split('T')[0] === dateStr);

    // Sort by time (HH:mm format)
    return filtered.sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    // Convert HH:mm to HHgmm format (e.g., "13:30" -> "13g30")
    return time.replace(':', 'g');
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeek(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeek(newDate);
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(new Date());
  };

  const formatDate = (date: Date) => {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch làm việc</h1>
          <p className="text-sm text-gray-600 mt-1">
            Tuần {weekDates[0].getDate()}/{weekDates[0].getMonth() + 1} - {weekDates[6].getDate()}/{weekDates[6].getMonth() + 1}/{weekDates[6].getFullYear()}
          </p>
        </div>
        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-cyan-600 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Lịch
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-cyan-600 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Bảng
            </button>
          </div>

          <button
            onClick={goToPreviousWeek}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Tuần trước
          </button>
          <button
            onClick={goToCurrentWeek}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Tuần hiện tại
          </button>
          <button
            onClick={goToNextWeek}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Tuần sau →
          </button>
          <Link
            href="/dashboard/calendar/new"
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg hover:from-cyan-600 hover:to-blue-600"
          >
            + Thêm sự kiện
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          <p className="text-gray-600 mt-2">Đang tải...</p>
        </div>
      ) : viewMode === 'calendar' ? (
        // Calendar Grid View
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {/* Day Headers */}
            {weekDayNames.map((dayName, index) => (
              <div key={index} className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-3 text-center font-semibold">
                <div>{dayName}</div>
                <div className="text-sm font-normal mt-1">
                  {formatDate(weekDates[index])}
                </div>
              </div>
            ))}

            {/* Day Cells */}
            {weekDates.map((date, dayIndex) => {
              const dayEvents = getEventsForDate(date);
              const today = isToday(date);

              return (
                <div
                  key={dayIndex}
                  className={`bg-white min-h-[300px] p-3 ${
                    today ? 'ring-2 ring-cyan-500 ring-inset' : ''
                  }`}
                >
                  {today && (
                    <div className="mb-2 px-2 py-1 bg-cyan-500 text-white text-xs rounded-full text-center font-medium">
                      Hôm nay
                    </div>
                  )}

                  <div className="space-y-2">
                    {dayEvents.length === 0 ? (
                      <div className="text-gray-400 text-sm italic text-center py-8">
                        Không có sự kiện
                      </div>
                    ) : (
                      dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="group relative bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg p-2.5 transition-colors cursor-pointer"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            {event.time && (
                              <div className="flex-shrink-0 text-xs font-semibold text-cyan-700 bg-cyan-200 px-2 py-0.5 rounded">
                                {formatTime(event.time)}
                              </div>
                            )}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <Link
                                href={`/dashboard/calendar/${event.id}/edit`}
                                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                title="Chỉnh sửa"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </Link>
                              {deleteConfirm === event.id ? (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleDelete(event.id)}
                                    className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="text-[10px] px-1.5 py-0.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                  >
                                    X
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(event.id)}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded"
                                  title="Xóa"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                            {event.content}
                          </div>

                          {event.location && (
                            <div className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="line-clamp-1">{event.location}</span>
                            </div>
                          )}

                          {event.chair && (
                            <div className="text-xs text-gray-500 line-clamp-1">
                              <span className="font-semibold">Chủ trì:</span> {event.chair}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Table View
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold w-20">Giờ</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold w-40">Địa điểm</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Nội dung</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold w-48">Chủ trì</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold w-48">Đơn vị chuẩn bị/tham dự</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold w-32">Ghi chú</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {weekDates.map((date, dayIndex) => {
                  const dayEvents = getEventsForDate(date);

                  return (
                    <>
                      {/* Day Header Row */}
                      <tr key={`header-${dayIndex}`}>
                        <td colSpan={7} className="border-0 p-0">
                          <div className="bg-gradient-to-r from-cyan-100 to-blue-100 border-t-2 border-cyan-300 px-4 py-2.5 font-bold text-cyan-800">
                            {weekDayNames[dayIndex]} - {formatDate(date)}
                          </div>
                        </td>
                      </tr>

                      {/* Event Rows */}
                      {dayEvents.length > 0 ? (
                        dayEvents.map((event, eventIndex) => (
                          <tr key={event.id} className={`hover:bg-cyan-50 transition-colors ${eventIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="border border-gray-300 px-4 py-3 w-20 font-medium text-cyan-700">{formatTime(event.time) || '-'}</td>
                            <td className="border border-gray-300 px-4 py-3 w-40">{event.location || '-'}</td>
                            <td className="border border-gray-300 px-4 py-3 whitespace-pre-wrap">{event.content}</td>
                            <td className="border border-gray-300 px-4 py-3 w-48 whitespace-pre-wrap">{event.chair || '-'}</td>
                            <td className="border border-gray-300 px-4 py-3 w-48 whitespace-pre-wrap">{event.participants || '-'}</td>
                            <td className="border border-gray-300 px-4 py-3 w-32 whitespace-pre-wrap">{event.note || '-'}</td>
                            <td className="border border-gray-300 px-4 py-3 text-center w-24">
                              <div className="flex items-center justify-center gap-2">
                                <Link
                                  href={`/dashboard/calendar/${event.id}/edit`}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Link>
                                {deleteConfirm === event.id ? (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleDelete(event.id)}
                                      className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                      Xác nhận
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(event.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-gray-400 italic border-b border-gray-200">
                            Không có sự kiện
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Chi tiết sự kiện</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Date and Time */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày</label>
                  <div className="flex items-center gap-2 text-gray-900">
                    <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(new Date(selectedEvent.date))}</span>
                  </div>
                </div>
                {selectedEvent.time && (
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Giờ</label>
                    <div className="flex items-center gap-2 text-gray-900">
                      <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatTime(selectedEvent.time)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Location */}
              {selectedEvent.location && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Địa điểm</label>
                  <div className="flex items-start gap-2 text-gray-900">
                    <svg className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="whitespace-pre-wrap">{selectedEvent.location}</span>
                  </div>
                </div>
              )}

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nội dung</label>
                <div className="flex items-start gap-2 text-gray-900">
                  <svg className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="whitespace-pre-wrap bg-gray-50 p-3 rounded-lg flex-1">{selectedEvent.content}</p>
                </div>
              </div>

              {/* Chair */}
              {selectedEvent.chair && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Người chủ trì</label>
                  <div className="flex items-start gap-2 text-gray-900">
                    <svg className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="whitespace-pre-wrap">{selectedEvent.chair}</span>
                  </div>
                </div>
              )}

              {/* Participants */}
              {selectedEvent.participants && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Đơn vị chuẩn bị/tham dự</label>
                  <div className="flex items-start gap-2 text-gray-900">
                    <svg className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="whitespace-pre-wrap">{selectedEvent.participants}</span>
                  </div>
                </div>
              )}

              {/* Note */}
              {selectedEvent.note && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                  <div className="flex items-start gap-2 text-gray-900">
                    <svg className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <span className="whitespace-pre-wrap bg-yellow-50 p-3 rounded-lg flex-1">{selectedEvent.note}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t">
              <Link
                href={`/dashboard/calendar/${selectedEvent.id}/edit`}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Chỉnh sửa
              </Link>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
