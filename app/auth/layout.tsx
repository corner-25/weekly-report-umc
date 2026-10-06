import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Đăng nhập · UMC Điều hành". */
export const metadata: Metadata = { title: 'Đăng nhập' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
