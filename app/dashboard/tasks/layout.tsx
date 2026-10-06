import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "Nhiệm vụ các phòng · UMC Điều hành". */
export const metadata: Metadata = { title: 'Nhiệm vụ các phòng' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
