import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Quản lý công việc · UMC Điều hành". */
export const metadata: Metadata = { title: 'Quản lý công việc' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
