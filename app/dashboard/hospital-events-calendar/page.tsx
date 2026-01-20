'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { startOfWeek, endOfWeek, addWeeks, format, addDays, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MeetingRoom {
  id: string;
  name: string;
}

interface ChecklistItem {
  isCompleted: boolean;
}

interface HospitalEvent {
  id: string;
  name: string;
  date: string;
  time?: string | null;
  eventType: 'ORGANIZED' | 'COLLABORATED';
  status: 'CONFIRMED' | 'UNCONFIRMED';
  isEdited: boolean;
  meetingRoom?: MeetingRoom | null;
  checklistItems: ChecklistItem[];
}

export default function HospitalEventsCalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [events, setEvents] = useState<HospitalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [filterRoom, setFilterRoom] = useState<string>('');
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [weekStart]);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/meeting-rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams({
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
      });

      const res = await fetch(`/api/hospital-events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchType = !filterType || event.eventType === filterType;
    const matchRoom = !filterRoom || event.meetingRoom?.id === filterRoom;
    return matchType && matchRoom;
  });

  const getEventsByDay = (day: Date) => {
    return filteredEvents.filter(event =>
      isSameDay(new Date(event.date), day)
    );
  };

  const getEventTypeColor = (type: string) => {
    return type === 'ORGANIZED'
      ? 'bg-blue-100 border-blue-300 text-blue-900'
      : 'bg-green-100 border-green-300 text-green-900';
  };

  const getStatusColor = (status: string, isEdited: boolean) => {
    if (isEdited) return 'border-l-orange-500';
    return status === 'CONFIRMED' ? 'border-l-green-500' : 'border-l-yellow-500';
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Lịch Sự kiện Bệnh viện</h1>
        <p className="mt-2 text-gray-600">Xem lịch sự kiện theo tuần</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ← Tuần trước
          </button>
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Tuần này
          </button>
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Tuần sau →
          </button>
        </div>

        <div className="flex-1 text-center">
          <div className="font-semibold text-lg text-gray-900">
            {format(weekStart, 'dd/MM/yyyy', { locale: vi })} - {format(weekEnd, 'dd/MM/yyyy', { locale: vi })}
          </div>
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Tất cả loại</option>
          <option value="ORGANIZED">Tổ chức</option>
          <option value="COLLABORATED">Phối hợp</option>
        </select>

        <select
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Tất cả phòng</option>
          {rooms.map(room => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="mb-6 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
          <span>Tổ chức</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
          <span>Phối hợp</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-l-4 border-l-green-500 bg-gray-100"></div>
          <span>Đã xác nhận</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-l-4 border-l-yellow-500 bg-gray-100"></div>
          <span>Chưa xác nhận</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-l-4 border-l-orange-500 bg-gray-100"></div>
          <span>Đã chỉnh sửa</span>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="text-center py-12">Đang tải...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-gray-200">
            {days.map((day) => {
              const dayEvents = getEventsByDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[200px] p-2 ${isToday ? 'bg-blue-50' : ''}`}
                >
                  <div className={`text-center mb-2 ${isToday ? 'font-bold text-blue-600' : 'text-gray-700'}`}>
                    <div className="text-xs uppercase">{format(day, 'EEEE', { locale: vi })}</div>
                    <div className="text-lg">{format(day, 'dd')}</div>
                  </div>

                  <div className="space-y-1">
                    {dayEvents.map(event => {
                      const completedCount = event.checklistItems.filter(item => item.isCompleted).length;
                      const totalCount = event.checklistItems.length;

                      return (
                        <Link
                          key={event.id}
                          href={`/dashboard/hospital-events/${event.id}`}
                          className={`block p-2 rounded text-xs border-l-4 ${getEventTypeColor(event.eventType)} ${getStatusColor(event.status, event.isEdited)} hover:shadow-md transition-shadow`}
                        >
                          <div className="font-medium truncate">{event.name}</div>
                          {event.time && (
                            <div className="text-xs opacity-75">🕐 {event.time}</div>
                          )}
                          {event.meetingRoom && (
                            <div className="text-xs opacity-75 truncate">🏢 {event.meetingRoom.name}</div>
                          )}
                          <div className="text-xs opacity-75 mt-1">
                            ✓ {completedCount}/{totalCount}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredEvents.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center mt-6">
          <p className="text-gray-500">Không có sự kiện nào trong tuần này</p>
        </div>
      )}
    </div>
  );
}
