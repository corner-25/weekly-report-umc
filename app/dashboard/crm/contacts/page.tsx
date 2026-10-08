'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Building2, Contact, Plus, Stethoscope, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { ContactModal } from '@/components/crm/ContactModal';
import { OrganizationModal } from '@/components/crm/OrganizationModal';
import { ContactsTab } from '@/components/crm/directory/ContactsTab';
import { OrganizationsTab } from '@/components/crm/directory/OrganizationsTab';
import { PRIMARY_BTN } from '@/components/crm/ui';

type Tab = 'contacts' | 'doctors' | 'organizations';
export default function CrmContactsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Đang tải...</div>}>
      <ContactsDirectory />
    </Suspense>
  );
}

function ContactsDirectory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'organizations' ? 'organizations' : tabParam === 'doctors' ? 'doctors' : 'contacts';
  const [showModal, setShowModal] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const switchTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'contacts') params.delete('tab');
    else params.set('tab', next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Contact}
        title="Danh bạ đối tác"
        description="Cá nhân (VIP, đối tác), danh mục bác sĩ và tổ chức — mỗi tổ chức có đầu mối liên hệ"
        className="flex-wrap gap-4"
        actions={
          <button type="button" onClick={() => setShowModal(true)} className={PRIMARY_BTN}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {tab === 'organizations' ? 'Thêm tổ chức' : tab === 'doctors' ? 'Thêm bác sĩ' : 'Thêm cá nhân'}
          </button>
        }
      />

      <div role="tablist" aria-label="Loại đối tác" className="flex gap-6 border-b border-slate-200">
        {([
          ['contacts', 'Cá nhân', UserRound],
          ['doctors', 'Bác sĩ', Stethoscope],
          ['organizations', 'Tổ chức', Building2],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            onClick={() => switchTab(value)}
            className={cn(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-semibold transition',
              tab === value ? 'border-cyan-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'organizations' ? (
          <OrganizationsTab reloadKey={reloadKey} onChanged={() => setReloadKey((k) => k + 1)} />
        ) : (
          <ContactsTab
            key={tab}
            initialKind={tab === 'doctors' ? 'doctor' : ''}
            reloadKey={reloadKey}
            onChanged={() => setReloadKey((k) => k + 1)}
          />
        )}
      </div>

      {showModal && tab !== 'organizations' && (
        <ContactModal
          initial={tab === 'doctors' ? ({ tags: ['Bác sĩ'] } as any) : undefined}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {showModal && tab === 'organizations' && (
        <OrganizationModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
