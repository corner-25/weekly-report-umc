import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Số liệu theo dõi · UMC Điều hành". */
export const metadata: Metadata = { title: 'Số liệu theo dõi' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
