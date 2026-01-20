'use client';

import { useState, useEffect } from 'react';

interface MeetingRoom {
  id: string;
  name: string;
  location?: string | null;
  capacity: number;
}

interface MeetingRoomSelectorProps {
  value: string | null;
  onChange: (roomId: string | null) => void;
}

export function MeetingRoomSelector({ value, onChange }: MeetingRoomSelectorProps) {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/meeting-rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRoom = rooms.find(r => r.id === value);

  return (
    <div className="space-y-2">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        disabled={loading}
      >
        <option value="">-- Không chọn phòng --</option>
        {rooms.map(room => (
          <option key={room.id} value={room.id}>
            {room.name} {room.location ? `(${room.location})` : ''} - {room.capacity} người
          </option>
        ))}
      </select>

      {selectedRoom && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
          <div className="font-medium text-blue-900">{selectedRoom.name}</div>
          {selectedRoom.location && (
            <div className="text-blue-700">📍 {selectedRoom.location}</div>
          )}
          <div className="text-blue-700">👥 Sức chứa: {selectedRoom.capacity} người</div>
        </div>
      )}
    </div>
  );
}
