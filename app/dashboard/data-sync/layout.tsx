import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Đồng bộ dữ liệu · UMC Điều hành". */
export const metadata: Metadata = { title: 'Đồng bộ dữ liệu' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
