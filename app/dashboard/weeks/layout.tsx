import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Báo cáo tuần Bệnh viện · UMC Điều hành". */
export const metadata: Metadata = { title: 'Báo cáo tuần Bệnh viện' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
