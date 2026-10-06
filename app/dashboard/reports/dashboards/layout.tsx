import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Dashboard số liệu · UMC Điều hành". */
export const metadata: Metadata = { title: 'Dashboard số liệu' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
