import Link from 'next/link';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

const colorMap = {
  cyan: {
    border: 'border-cyan-200/80',
    bg: 'from-cyan-50/60 via-white to-white',
    badge: 'bg-cyan-100 text-cyan-700 shadow-cyan-200/50',
    title: 'text-cyan-800',
    unit: 'text-cyan-700',
  },
  blue: {
    border: 'border-blue-200/80',
    bg: 'from-blue-50/60 via-white to-white',
    badge: 'bg-blue-100 text-blue-700 shadow-blue-200/50',
    title: 'text-blue-800',
    unit: 'text-blue-700',
  },
  purple: {
    border: 'border-purple-200/80',
    bg: 'from-purple-50/60 via-white to-white',
    badge: 'bg-purple-100 text-purple-700 shadow-purple-200/50',
    title: 'text-purple-800',
    unit: 'text-purple-700',
  },
  green: {
    border: 'border-emerald-200/80',
    bg: 'from-emerald-50/60 via-white to-white',
    badge: 'bg-emerald-100 text-emerald-700 shadow-emerald-200/50',
    title: 'text-emerald-800',
    unit: 'text-emerald-700',
  },
  orange: {
    border: 'border-amber-200/80',
    bg: 'from-amber-50/60 via-white to-white',
    badge: 'bg-amber-100 text-amber-700 shadow-amber-200/50',
    title: 'text-amber-800',
    unit: 'text-amber-700',
  },
  pink: {
    border: 'border-rose-200/80',
    bg: 'from-rose-50/60 via-white to-white',
    badge: 'bg-rose-100 text-rose-700 shadow-rose-200/50',
    title: 'text-rose-800',
    unit: 'text-rose-700',
  },
  red: {
    border: 'border-red-200/80',
    bg: 'from-red-50/60 via-white to-white',
    badge: 'bg-red-100 text-red-700 shadow-red-200/50',
    title: 'text-red-800',
    unit: 'text-red-700',
  },
  gray: {
    border: 'border-slate-200/80',
    bg: 'from-slate-50/60 via-white to-white',
    badge: 'bg-slate-100 text-slate-700 shadow-slate-200/50',
    title: 'text-slate-800',
    unit: 'text-slate-600',
  },
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
  const c = colorMap[color];

  const content = (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-sm transition-all duration-200 bg-gradient-to-br',
        c.border,
        c.bg,
        href ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-xs font-bold uppercase tracking-wider', c.title)}>{label}</p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">
              {value}
            </span>
            {subValue && <span className={cn('text-xs font-bold', c.unit)}>{subValue}</span>}
          </div>
        </div>
        {Icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105', c.badge)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
        {content}
      </Link>
    );
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
  const c = colorMap[color];

  return (
    <div className={cn('rounded-2xl border p-3.5 bg-gradient-to-br', c.border, c.bg, className)}>
      <p className={cn('text-xs font-bold uppercase tracking-wider', c.title)}>{label}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
