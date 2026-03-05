'use client';

interface EventTypeSelectorProps {
  value: 'ORGANIZED' | 'COLLABORATED';
  onChange: (type: 'ORGANIZED' | 'COLLABORATED') => void;
}

export function EventTypeSelector({ value, onChange }: EventTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        type="button"
        onClick={() => onChange('ORGANIZED')}
        className={`p-4 rounded-lg border-2 transition-all ${
          value === 'ORGANIZED'
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-center mb-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            value === 'ORGANIZED' ? 'bg-blue-500' : 'bg-gray-300'
          }`}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-gray-900">Tổ chức</div>
          <div className="text-xs text-gray-500 mt-1">Phòng chúng tôi tổ chức</div>
          <div className="mt-2">
            <span className="inline-block px-2 py-1 rounded text-xs bg-blue-100 text-blue-900">
              Màu xanh dương
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange('COLLABORATED')}
        className={`p-4 rounded-lg border-2 transition-all ${
          value === 'COLLABORATED'
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-center mb-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            value === 'COLLABORATED' ? 'bg-green-500' : 'bg-gray-300'
          }`}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-gray-900">Phối hợp</div>
          <div className="text-xs text-gray-500 mt-1">Phòng chúng tôi phối hợp</div>
          <div className="mt-2">
            <span className="inline-block px-2 py-1 rounded text-xs bg-green-100 text-green-900">
              Màu xanh lá
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
