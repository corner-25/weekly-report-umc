import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isQuickEntryKind, quickEntryPath } from '@/lib/crm/quick-entry';
import { QuickEntry } from '@/components/crm/QuickEntry';

export const metadata = { title: 'Nhập nhanh · Phòng Hành chính' };

/** Trang nhập liệu một tay trên điện thoại, mở từ mã QR. Chưa đăng nhập thì đăng nhập xong quay lại đúng form. */
export default async function QuickEntryPage({ searchParams }: { searchParams: Promise<{ loai?: string }> }) {
  const { loai } = await searchParams;
  const kind = isQuickEntryKind(loai) ? loai : undefined;
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(quickEntryPath(kind))}`);
  return <QuickEntry initialKind={kind} userName={session.user.name ?? ''} />;
}
