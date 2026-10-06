import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Giấy phép · UMC Điều hành". */
export const metadata: Metadata = { title: 'Giấy phép' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
