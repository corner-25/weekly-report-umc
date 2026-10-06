import { redirect } from 'next/navigation';

/** Nhập từ Excel đã bỏ: báo cáo các phòng được quét tự động hằng ngày. */
export default function Page() {
  redirect('/dashboard/weeks');
}
