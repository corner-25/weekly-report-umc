'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download } from 'lucide-react';
import { QUICK_ENTRY_KINDS, quickEntryPath, type QuickEntryKind } from '@/lib/crm/quick-entry';
import { ModalShell, SECONDARY_BTN } from './ui';

interface QrItem {
  kind: QuickEntryKind | null;
  label: string;
  url: string;
  dataUrl: string;
}

/** Mã QR và đường dẫn nhập nhanh để in dán ở quầy hoặc gửi nhóm chat. */
export function QuickEntryQrModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<QrItem[]>([]);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const origin = window.location.origin;
    const kinds: Array<QuickEntryKind | null> = [null, ...(Object.keys(QUICK_ENTRY_KINDS) as QuickEntryKind[])];
    Promise.all(
      kinds.map(async (kind) => {
        const url = origin + quickEntryPath(kind ?? undefined);
        const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M' });
        return { kind, label: kind ? QUICK_ENTRY_KINDS[kind].label : 'Tất cả (chọn sau khi quét)', url, dataUrl };
      }),
    ).then(setItems);
  }, []);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
    } catch {
      setCopied('');
    }
  };

  return (
    <ModalShell title="Mã QR nhập nhanh" subtitle="Quét bằng camera điện thoại để mở form; cần đăng nhập tài khoản hệ thống." onClose={onClose}>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        {items.length === 0 && <p className="text-sm text-slate-500">Đang tạo mã...</p>}
        {items.map((item) => (
          <figure key={item.url} className="space-y-2 rounded-xl border border-slate-200 p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.dataUrl} alt={`Mã QR: ${item.label}`} className="mx-auto h-40 w-40" />
            <figcaption className="text-sm font-semibold text-slate-900">{item.label}</figcaption>
            <p className="break-all text-xs text-slate-500">{item.url}</p>
            <div className="flex justify-center gap-2">
              <button type="button" onClick={() => copy(item.url)} className={SECONDARY_BTN}>
                {copied === item.url ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied === item.url ? 'Đã chép' : 'Chép link'}
              </button>
              <a href={item.dataUrl} download={`qr-nhap-nhanh-${item.kind ?? 'tat-ca'}.png`} className={SECONDARY_BTN}>
                <Download className="h-4 w-4" aria-hidden="true" /> Tải ảnh
              </a>
            </div>
          </figure>
        ))}
      </div>
    </ModalShell>
  );
}
