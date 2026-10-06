import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Hợp tác (MOU) · UMC Điều hành". */
export const metadata: Metadata = { title: 'Hợp tác (MOU)' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
