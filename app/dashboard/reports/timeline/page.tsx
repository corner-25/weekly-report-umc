import { redirect } from 'next/navigation';

/** Đã gộp vào Nhiệm vụ các phòng (dòng thời gian). */
export default function Page() {
  redirect('/dashboard/tasks/progress?xem=dong-thoi-gian');
}
