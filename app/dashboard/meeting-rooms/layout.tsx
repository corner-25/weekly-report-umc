import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Phòng họp · UMC Điều hành". */
export const metadata: Metadata = { title: 'Phòng họp' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
