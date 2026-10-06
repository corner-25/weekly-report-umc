import { redirect } from 'next/navigation';

/** Phân tích nhiệm vụ đã gộp vào Nhiệm vụ các phòng (tổng quan toàn viện). */
export default function Page() {
  redirect('/dashboard/tasks/progress?xem=tong-quan');
}
