import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Khách VIP · UMC Điều hành". */
export const metadata: Metadata = { title: 'Khách VIP' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
