'use client';

interface EquipmentBadgesProps {
  room: {
    hasMicrophone?: boolean;
    hasSpeaker?: boolean;
    hasProjector?: boolean;
    hasScreen?: boolean;
    hasTV?: boolean;
    hasSmartBoard?: boolean;
    hasWifi?: boolean;
    hasAircon?: boolean;
    hasWhiteboard?: boolean;
  };
}

export function EquipmentBadges({ room }: EquipmentBadgesProps) {
  const equipment = [
    { key: 'hasMicrophone', label: 'Micro', icon: '🎤' },
    { key: 'hasSpeaker', label: 'Loa', icon: '🔊' },
    { key: 'hasProjector', label: 'Máy chiếu', icon: '📽️' },
    { key: 'hasScreen', label: 'Màn hình', icon: '🖥️' },
    { key: 'hasTV', label: 'TV', icon: '📺' },
    { key: 'hasSmartBoard', label: 'Bảng thông minh', icon: '📊' },
    { key: 'hasWifi', label: 'Wifi', icon: '📶' },
    { key: 'hasAircon', label: 'Điều hòa', icon: '❄️' },
    { key: 'hasWhiteboard', label: 'Bảng viết', icon: '📝' },
  ];

  const activeEquipment = equipment.filter(item => room[item.key as keyof typeof room]);

  if (activeEquipment.length === 0) {
    return <span className="text-gray-400 text-sm">Chưa có thông tin thiết bị</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {activeEquipment.map(item => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs"
          title={item.label}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
