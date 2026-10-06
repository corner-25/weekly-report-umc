import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Thư ký · UMC Điều hành". */
export const metadata: Metadata = { title: 'Thư ký' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
