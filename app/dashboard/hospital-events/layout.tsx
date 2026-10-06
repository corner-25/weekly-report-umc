import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Sự kiện bệnh viện · UMC Điều hành". */
export const metadata: Metadata = { title: 'Sự kiện bệnh viện' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
