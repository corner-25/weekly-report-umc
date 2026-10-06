import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  // Tên hiện trên tab trình duyệt; biểu tượng tab lấy từ app/favicon.ico, app/icon.png, app/apple-icon.png (logo UMC).
  title: { default: "UMC Điều hành", template: "%s · UMC Điều hành" },
  applicationName: "UMC Điều hành",
  appleWebApp: { title: "UMC Điều hành" },
  description: "Hệ thống quản lý tập trung của Phòng Hành chính — Bệnh viện Đại học Y Dược TP.HCM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        {/* Thanh tiến trình khi đổi trang: bấm là thấy phản hồi ngay, kể cả khi máy chủ còn đang trả lời. */}
        <NextTopLoader color="#3d84e0" height={3} showSpinner={false} shadow={false} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
