import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Cài đặt · UMC Điều hành". */
export const metadata: Metadata = { title: 'Cài đặt' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
