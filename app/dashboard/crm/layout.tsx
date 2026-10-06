import type { Metadata } from 'next';

/** Tên trang trên tab trình duyệt — ghép thành "CRM đối tác · UMC Điều hành". */
export const metadata: Metadata = { title: 'CRM đối tác' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
