'use client';

/**
 * Biểu đồ SVG nhỏ gọn cho bảng điều hành công việc — không kéo thư viện biểu đồ
 * (vài chục KB) chỉ để vẽ cột, vòng và thanh chồng. Màu lấy từ lớp Tailwind
 * nên theo đúng bảng màu của ứng dụng.
 */
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** Lớp nét cho vòng (stroke-*) và lớp nền cho thanh/chú thích (bg-*) — ghi nguyên văn để Tailwind giữ lại. */
  stroke: string;
  swatch: string;
  /** Nút giải thích hiện sau nhãn trong chú thích. */
  info?: ReactNode;
}

const TAU = Math.PI * 2;

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0;
  const p = (a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  return `M ${p(start)} A ${r} ${r} 0 ${large} 1 ${p(end)}`;
}

/** Vòng tỷ lệ; con số chính ở giữa. Rê chuột vào một cung để xem số của cung đó. */
export function Donut({ segments, centerValue, centerLabel, size = 184 }: { segments: Segment[]; centerValue: string; centerLabel: string; size?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = size / 2;
  let angle = 0;
  const active = segments.find((s) => s.key === hover);
  const summary = segments.map((s) => `${s.label} ${s.value}`).join(', ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={summary} className="shrink-0">
      <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100" />
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const sweep = (s.value / total) * TAU;
            const gap = segments.filter((x) => x.value > 0).length > 1 ? 0.012 : 0;
            const d = sweep >= TAU - 0.001 ? null : arcPath(c, c, r, angle + gap, angle + sweep - gap);
            angle += sweep;
            const cls = cn(s.stroke, 'transition-opacity duration-150', hover && hover !== s.key && 'opacity-35');
            return d ? (
              <path key={s.key} d={d} fill="none" strokeWidth={stroke} className={cls} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
                <title>{`${s.label}: ${s.value}`}</title>
              </path>
            ) : (
              <circle key={s.key} cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className={cls} />
            );
          })}
      <text x={c} y={c - 2} textAnchor="middle" className="fill-slate-900 text-[34px] font-bold tabular-nums">
        {active ? active.value : centerValue}
      </text>
      <text x={c} y={c + 22} textAnchor="middle" className="fill-slate-500 text-[12px] font-medium">
        {active ? active.label : centerLabel}
      </text>
    </svg>
  );
}

export function Legend({ segments, total }: { segments: Segment[]; total?: number }) {
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  return (
    <ul className="space-y-1.5 text-sm">
      {segments.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', s.swatch)} aria-hidden="true" />
          <span className="flex flex-1 items-center gap-0.5 text-slate-600">{s.label}{s.info}</span>
          <span className="font-semibold tabular-nums text-slate-900">{s.value}</span>
          <span className="w-10 text-right text-xs tabular-nums text-slate-400">{sum ? `${Math.round((s.value / sum) * 100)}%` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

/** Thanh chồng ngang một dòng (vd hoàn thành / đang làm / quá hạn của một đơn vị). */
export function StackBar({ segments, total, className }: { segments: Segment[]; total?: number; className?: string }) {
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-slate-100', className)} role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
      {sum > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => <span key={s.key} className={cn('h-full', s.swatch)} style={{ width: `${(s.value / sum) * 100}%` }} title={`${s.label}: ${s.value}`} />)}
    </div>
  );
}

export interface MonthDatum {
  month: string;
  assigned: number;
  completed: number;
  backlog: number;
}

const monthLabel = (m: string) => `T${Number(m.slice(5))}`;
const niceMax = (v: number) => {
  if (v <= 5) return 5;
  const step = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / step) * step;
};

/** Cột: việc giao và việc xong mỗi tháng; đường: việc còn tồn cuối tháng (trục phải). */
export function MonthlyChart({ data, legend }: { data: MonthDatum[]; legend?: ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 260;
  const pad = { l: 34, r: 40, t: 14, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const maxBar = niceMax(Math.max(1, ...data.map((d) => Math.max(d.assigned, d.completed))));
  const maxLine = niceMax(Math.max(1, ...data.map((d) => d.backlog)));
  const slot = iw / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(14, slot * 0.32));
  const x = (i: number) => pad.l + slot * i + slot / 2;
  const yBar = (v: number) => pad.t + ih - (v / maxBar) * ih;
  const yLine = (v: number) => pad.t + ih - (v / maxLine) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(data.length / 12);
  const line = data.map((d, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${yLine(d.backlog).toFixed(1)}`).join(' ');
  const area = data.length ? `${line} L ${x(data.length - 1).toFixed(1)} ${pad.t + ih} L ${x(0).toFixed(1)} ${pad.t + ih} Z` : '';
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Việc giao, việc hoàn thành và việc tồn theo tháng" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih * (1 - t)} y2={pad.t + ih * (1 - t)} className="stroke-slate-100" />
            <text x={pad.l - 6} y={pad.t + ih * (1 - t) + 4} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">{Math.round(maxBar * t)}</text>
            <text x={W - pad.r + 6} y={pad.t + ih * (1 - t) + 4} className="fill-amber-600/70 text-[10px] tabular-nums">{Math.round(maxLine * t)}</text>
          </g>
        ))}
        <path d={area} className="fill-amber-400/10" />
        {data.map((d, i) => (
          <g key={d.month}>
            {hover === i && <rect x={x(i) - slot / 2} y={pad.t} width={slot} height={ih} className="fill-slate-100/70" />}
            <rect x={x(i) - barW - 1} y={yBar(d.assigned)} width={barW} height={pad.t + ih - yBar(d.assigned)} rx={2} className="fill-brand-500" />
            <rect x={x(i) + 1} y={yBar(d.completed)} width={barW} height={pad.t + ih - yBar(d.completed)} rx={2} className="fill-emerald-500" />
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - pad.b + 16} textAnchor="middle" className="fill-slate-500 text-[10px]">{monthLabel(d.month)}</text>
            )}
            {(i === 0 || d.month.endsWith('-01')) && (
              <text x={x(i)} y={H - pad.b + 29} textAnchor="middle" className="fill-slate-400 text-[10px] font-semibold">{d.month.slice(0, 4)}</text>
            )}
            <rect x={x(i) - slot / 2} y={pad.t} width={slot} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
        <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="pointer-events-none stroke-amber-500" />
        {h && hover !== null && <circle cx={x(hover)} cy={yLine(h.backlog)} r={4} className="pointer-events-none fill-white stroke-amber-500" strokeWidth={2} />}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-44 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 88px), calc(100% - 176px))` }}
        >
          <p className="mb-1 font-bold text-slate-900">Tháng {Number(h.month.slice(5))}/{h.month.slice(0, 4)}</p>
          <p className="flex justify-between"><span className="text-slate-500">Giao mới</span><b className="tabular-nums">{h.assigned}</b></p>
          <p className="flex justify-between"><span className="text-slate-500">Hoàn thành</span><b className="tabular-nums text-emerald-700">{h.completed}</b></p>
          <p className="flex justify-between"><span className="text-slate-500">Tồn cuối tháng</span><b className="tabular-nums text-amber-700">{h.backlog}</b></p>
        </div>
      )}
      {legend}
    </div>
  );
}

/** Cột đứng đơn giản có nhãn, dùng cho phân bố (vd tiến độ việc đang mở). */
export function ColumnChart({ data, barClass = 'bg-brand-500' }: { data: Array<{ label: string; count: number; className?: string }>; barClass?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-44 items-end gap-2" role="img" aria-label={data.map((d) => `${d.label}: ${d.count}`).join(', ')}>
      {data.map((d) => (
        <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold tabular-nums text-slate-700">{d.count}</span>
          <div className={cn('w-full max-w-[44px] origin-bottom rounded-t-md transition-transform duration-500', d.className ?? barClass)} style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }} />
          <span className="flex h-7 w-full items-start justify-center text-center text-[11px] leading-tight text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
