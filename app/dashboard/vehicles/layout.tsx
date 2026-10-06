import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Phương tiện · UMC Điều hành". */
export const metadata: Metadata = { title: 'Phương tiện' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
