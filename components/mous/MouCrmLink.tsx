'use client';

/**
 * Đối tác MOU ↔ tổ chức trong CRM: xem tổ chức đã nối (sang CRM xem tiếp đoàn,
 * đầu mối), đổi tổ chức, bỏ nối, hoặc tạo tổ chức mới trong CRM từ tên đối tác.
 */
import Link from 'next/link';
import { useState } from 'react';
import { Building2, ExternalLink, Plus, Sparkles } from 'lucide-react';
import { Select } from '@/components/ui/Select';

export interface CrmLinkMou {
  id: string;
  partnerName: string;
  crmOrganization?: { id: string; name: string; category: string | null; _count?: { interactions: number; positions: number } } | null;
  crmMatch?: { by?: string; relation?: string; confidence?: string; reason?: string; suggestionId?: string; suggestionName?: string } | null;
}

const RELATION: Record<string, string> = { SAME: 'cùng đơn vị', PARENT: 'đơn vị mẹ của đối tác', BRANCH: 'chi nhánh của đối tác' };

export function MouCrmLink({ mou, onChanged }: { mou: CrmLinkMou; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const org = mou.crmOrganization;
  const match = mou.crmMatch;

  const save = async (body: object) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/mous/${mou.id}/crm-link`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Không lưu được');
      setEditing(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const startEdit = async () => {
    setEditing(true);
    if (orgs) return;
    const res = await fetch('/api/crm/organizations');
    const data = res.ok ? await res.json() : [];
    setOrgs((Array.isArray(data) ? data : data.organizations ?? data.items ?? []).map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
  };

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Tổ chức trong CRM
          </p>
          {org ? (
            <>
              <Link href={`/dashboard/crm/organizations/${org.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:underline">
                {org.name} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <p className="text-xs text-slate-500">
                {org._count ? `${org._count.interactions} lượt tiếp đón/làm việc · ${org._count.positions} đầu mối` : org.category}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Chưa nối — đối tác này chưa có trong danh bạ CRM.</p>
          )}
          {match?.reason && (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-400">
              {match.by === 'AI' && <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" aria-hidden="true" />}
              {match.by === 'AI' ? `AI ghép${match.relation && RELATION[match.relation] ? ` (${RELATION[match.relation]})` : ''}: ` : ''}
              {match.reason}
            </p>
          )}
          {!org && match?.suggestionId && (
            <button type="button" disabled={busy} onClick={() => save({ organizationId: match.suggestionId })} className="mt-1 text-xs font-medium text-cyan-700 hover:underline">
              AI nghi là "{match.suggestionName}" — nối luôn?
            </button>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {!org && (
            <button type="button" disabled={busy} onClick={() => save({ create: true })} className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Tạo trong CRM
            </button>
          )}
          <button type="button" onClick={editing ? () => setEditing(false) : startEdit} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
            {editing ? 'Đóng' : org ? 'Đổi' : 'Chọn có sẵn'}
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="min-w-[260px] flex-1">
            <Select value={org?.id ?? ''} disabled={!orgs || busy} onChange={(e) => save({ organizationId: e.target.value || null })} aria-label="Chọn tổ chức trong CRM">
              <option value="">{orgs ? '— Không nối —' : 'Đang tải danh bạ…'}</option>
              {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-600" role="alert">{error}</p>}
    </div>
  );
}
