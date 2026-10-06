import { redirect } from 'next/navigation';

/** Tạo báo cáo tay đã bỏ: báo cáo các phòng được quét tự động hằng ngày. */
export default function Page() {
  redirect('/dashboard/weeks');
}
