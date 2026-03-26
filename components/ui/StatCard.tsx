import Link from 'next/link';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

const colorMap = {
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', icon: 'bg-cyan-100 text-cyan-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100 text-blue-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'bg-purple-100 text-purple-600' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'bg-emerald-100 text-emerald-600' },
  orange: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'bg-amber-100 text-amber-600' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-600', icon: 'bg-pink-100 text-pink-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'bg-red-100 text-red-600' },
  gray: { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'bg-slate-100 text-slate-600' },
} as const;

type ColorKey = keyof typeof colorMap;

interface StatCardProps {
  label: string;
  value: number | string;
  subValue?: string;
  icon?: LucideIcon;
  color?: ColorKey;
  href?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  color = 'cyan',
  href,
  className,
}: StatCardProps) {
  const colors = colorMap[color];

  const content = (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200/80 p-4 transition-all duration-200',
        href && 'hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 cursor-pointer',
        className
      )}
    >
      {Icon && (
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', colors.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <p className="text-2xl font-bold text-slate-900">
        {value}
        {subValue && <span className="text-slate-400 text-lg font-normal">{subValue}</span>}
      </p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Compact version for use in sections like MOU stats
interface CompactStatCardProps {
  label: string;
  value: number | string;
  color?: ColorKey;
  className?: string;
}

export function CompactStatCard({ label, value, color = 'gray', className }: CompactStatCardProps) {
  const colors = colorMap[color];

  return (
    <div className={cn('rounded-xl p-3.5', colors.bg, className)}>
      <p className={cn('text-xs font-medium opacity-70', colors.text)}>{label}</p>
      <p className={cn('text-xl font-bold mt-0.5', colors.text)}>{value}</p>
    </div>
  );
}
