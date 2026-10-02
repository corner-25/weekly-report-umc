import { redirect } from 'next/navigation';

/** Trang Khách VIP cũ đã chuyển vào CRM đối tác — giữ đường dẫn cũ không chết. */
export default function VipGuestsPage() {
  redirect('/dashboard/crm/interactions');
}
