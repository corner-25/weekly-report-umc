'use client';

interface ChecklistProgressProps {
  completed: number;
  total: number;
  showPercentage?: boolean;
}

export function ChecklistProgress({ completed, total, showPercentage = false }: ChecklistProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {completed}/{total} hoàn thành
        </span>
        {showPercentage && (
          <span className="text-gray-600 font-medium">{percentage}%</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
