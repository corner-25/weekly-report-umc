import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Lịch sự kiện · UMC Điều hành". */
export const metadata: Metadata = { title: 'Lịch sự kiện' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
