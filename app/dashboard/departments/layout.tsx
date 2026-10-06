import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Phòng ban · UMC Điều hành". */
export const metadata: Metadata = { title: 'Phòng ban' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
