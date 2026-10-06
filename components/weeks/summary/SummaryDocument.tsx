'use client';

/**
 * Báo cáo tóm tắt hiển thị như văn bản gửi Ban Giám đốc (khổ A4, chữ Times),
 * in thẳng ra PDF được. Ở chế độ sửa: mỗi đoạn là ô sửa, ý con mỗi dòng một ý,
 * thêm/xoá đoạn, sửa kế hoạch tuần sau.
 */
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SummaryContent, SummaryItem } from '@/lib/weekly-summary/types';

const ROMAN_SECTION = 'I';
const autoRows = (text: string) => Math.min(12, Math.max(2, Math.ceil(text.length / 95) + text.split('\n').length - 1));

function Table({ item }: { item: Extract<SummaryItem, { type: 'table' }> }) {
  return (
    <div className="my-3 break-inside-avoid">
      <p className="mb-1 text-center font-bold">{item.title}</p>
      <table className="w-full border-collapse text-[0.95em]">
        <thead>
          <tr>
            {item.columns.map((c, i) => (
              <th key={c} scope="col" className={cn('border border-black px-2 py-1 font-bold', i === 0 ? 'text-left' : 'text-center')}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {item.rows.map((row, r) => (
            <tr key={r} className={cn(item.boldRows.includes(r) && 'font-bold')}>
              {row.map((cell, i) => (
                <td key={i} className={cn('border border-black px-2 py-1', i === 0 ? (item.boldRows.includes(r) ? '' : 'pl-4 italic') : 'text-center tabular-nums')}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {item.note && <p className="mt-1 text-[0.85em] italic">{item.note}</p>}
    </div>
  );
}

function TextView({ item }: { item: Extract<SummaryItem, { type: 'text' }> }) {
  return (
    <div className="mb-2">
      <p className="text-justify indent-8">
        - {item.label && <>{item.label}{item.text ? ': ' : ':'}</>}
        {item.text}
      </p>
      {item.subItems.map((s, i) => (
        <p key={i} className="ml-8 text-justify">+ {s}</p>
      ))}
    </div>
  );
}

function TextEditor({ item, onChange, onRemove }: { item: Extract<SummaryItem, { type: 'text' }>; onChange: (next: SummaryItem) => void; onRemove: () => void }) {
  return (
    <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50/30 p-2.5 font-sans text-sm">
      <div className="mb-1.5 flex items-center gap-2">
        <input
          aria-label="Tên mảng"
          value={item.label ?? ''}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
          placeholder="Tên mảng (vd Hành chính)"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold"
        />
        {item.origin === 'facts' && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700" title="Tính từ chỉ số đã trích">số liệu</span>}
        <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Xoá đoạn này">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <textarea
        aria-label="Nội dung"
        value={item.text}
        rows={autoRows(item.text)}
        onChange={(e) => onChange({ ...item, text: e.target.value })}
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 leading-relaxed"
      />
      <textarea
        aria-label="Ý con, mỗi dòng một ý"
        value={item.subItems.join('\n')}
        rows={Math.max(1, item.subItems.length + 1)}
        onChange={(e) => onChange({ ...item, subItems: e.target.value.split('\n').filter((s, i, arr) => s.trim() || i === arr.length - 1) })}
        placeholder="Ý con (dấu +), mỗi dòng một ý — không bắt buộc"
        className="mt-1.5 w-full resize-y rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-[13px] leading-relaxed"
      />
    </div>
  );
}

export function SummaryDocument({ content, editing, onChange }: { content: SummaryContent; editing: boolean; onChange: (next: SummaryContent) => void }) {
  const setItems = (sectionIndex: number, items: SummaryItem[]) =>
    onChange({ ...content, sections: content.sections.map((s, i) => (i === sectionIndex ? { ...s, items } : s)) });

  return (
    <article
      style={{ fontFamily: "'Times New Roman', Times, 'Liberation Serif', serif", fontVariantNumeric: 'lining-nums' }}
      className="summary-doc mx-auto w-full max-w-[820px] bg-white px-6 py-8 font-serif text-[15px] leading-[1.6] text-black shadow-sm ring-1 ring-slate-200 sm:px-14 sm:py-12 print:max-w-none print:p-0 print:shadow-none print:ring-0"
      lang="vi"
    >
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="text-center">
            <p className="uppercase">Bệnh viện Đại học Y Dược TPHCM</p>
            <p className="font-bold uppercase">Phòng Hành chính</p>
            <div className="mx-auto mt-1 w-28 border-t border-black" aria-hidden="true" />
          </div>
          <p className="self-end italic">{content.dateLine}</p>
        </div>
        <h1 className="mt-6 text-center text-[1.05em] font-bold uppercase leading-snug">
          Báo cáo tóm tắt
          <br />
          Hoạt động Bệnh viện tuần {content.week}/{content.year}
          <br />
          và kế hoạch tuần {content.week + 1}/{content.year}
        </h1>
      </header>

      <h2 className="mb-2 font-bold uppercase">{ROMAN_SECTION}. Hoạt động tuần {content.week}/{content.year}</h2>
      {content.sections.map((section, si) => (
        <section key={section.key} className="mb-4">
          <h3 className="mb-1.5 font-bold">{si + 1}. {section.heading}</h3>
          {si === 0 && <p className="mb-2 indent-8 italic">Số liệu tuần ({content.range}).</p>}
          {section.items.length === 0 && !editing && <p className="indent-8 italic text-slate-500">(chưa có nội dung)</p>}
          {section.items.map((item, ii) =>
            item.type === 'table' ? (
              <div key={ii} className="relative">
                <Table item={item} />
                {editing && (
                  <button type="button" onClick={() => setItems(si, section.items.filter((_, k) => k !== ii))} className="absolute -right-2 top-0 rounded-lg bg-white p-1.5 font-sans text-xs text-slate-400 shadow ring-1 ring-slate-200 hover:text-red-600" aria-label={`Xoá bảng ${item.title}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : editing ? (
              <TextEditor
                key={ii}
                item={item}
                onChange={(next) => setItems(si, section.items.map((x, k) => (k === ii ? next : x)))}
                onRemove={() => setItems(si, section.items.filter((_, k) => k !== ii))}
              />
            ) : (
              <TextView key={ii} item={item} />
            ),
          )}
          {editing && (
            <button
              type="button"
              onClick={() => setItems(si, [...section.items, { type: 'text', label: '', text: '', subItems: [], origin: 'manual' }])}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-sans text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Thêm đoạn
            </button>
          )}
        </section>
      ))}

      <h2 className="mb-2 mt-5 font-bold uppercase">II. Kế hoạch tuần {content.week + 1}/{content.year}</h2>
      {editing ? (
        <textarea
          aria-label="Kế hoạch tuần sau, mỗi dòng một việc"
          value={content.plan.join('\n')}
          rows={Math.max(4, content.plan.length + 1)}
          onChange={(e) => onChange({ ...content, plan: e.target.value.split('\n') })}
          className="w-full resize-y rounded-xl border border-brand-200 bg-brand-50/30 p-2.5 font-sans text-sm leading-relaxed"
          placeholder="Mỗi dòng một việc"
        />
      ) : content.plan.filter((p) => p.trim()).length ? (
        content.plan.filter((p) => p.trim()).map((p, i) => <p key={i} className="mb-1 text-justify indent-8">- {p}</p>)
      ) : (
        <p className="indent-8 italic text-slate-500">(chưa có kế hoạch)</p>
      )}
      <p className="mt-4 indent-8">Trân trọng./.</p>
    </article>
  );
}

/** Bản chữ thường để dán vào email/Zalo. */
export function summaryToText(c: SummaryContent): string {
  const lines = [
    `BÁO CÁO TÓM TẮT HOẠT ĐỘNG BỆNH VIỆN TUẦN ${c.week}/${c.year} VÀ KẾ HOẠCH TUẦN ${c.week + 1}/${c.year}`,
    '',
    `I. HOẠT ĐỘNG TUẦN ${c.week}/${c.year}`,
  ];
  c.sections.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.heading}`);
    for (const item of s.items) {
      if (item.type === 'text') {
        lines.push(`- ${item.label ? `${item.label}: ` : ''}${item.text}`);
        item.subItems.filter((x) => x.trim()).forEach((x) => lines.push(`  + ${x}`));
      } else {
        lines.push(`- ${item.title}:`);
        item.rows.forEach((r) => lines.push(`  ${r.join(' | ')}`));
      }
    }
  });
  lines.push('', `II. KẾ HOẠCH TUẦN ${c.week + 1}/${c.year}`, ...c.plan.filter((p) => p.trim()).map((p) => `- ${p}`), '', 'Trân trọng./.');
  return lines.join('\n');
}
