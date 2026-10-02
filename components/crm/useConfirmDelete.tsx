'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { crmSend, errorMessage } from './api';

export interface PendingDelete {
  title: string;
  message: string;
  url: string;
  onDone: () => void;
}

/** Hộp xác nhận xoá dùng chung: gọi DELETE tới `url`, báo lỗi qua `onError`. */
export function useConfirmDelete(onError: (message: string) => void) {
  const [pending, setPending] = useState<PendingDelete | null>(null);

  const confirm = async () => {
    if (!pending) return;
    const current = pending;
    setPending(null);
    try {
      await crmSend(current.url, 'DELETE');
      current.onDone();
    } catch (error) {
      onError(errorMessage(error, 'Không thể xoá. Vui lòng thử lại.'));
    }
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ''}
      message={pending?.message ?? ''}
      confirmLabel="Xoá"
      onConfirm={confirm}
      onCancel={() => setPending(null)}
    />
  );

  return { askDelete: setPending, deleteDialog: dialog };
}
