/**
 * Template dựng lại mỗi lần đổi trang (khác layout), nên nội dung trang mới hiện
 * lên nhẹ nhàng thay vì bật ngang. Sidebar nằm ở layout nên đứng yên.
 *
 * Hiệu ứng KHÔNG được giữ transform sau khi chạy xong (fill-mode backwards, xem
 * tailwind.config): phần tử còn transform/animation thành khối chứa của mọi
 * phần tử fixed bên trong — modal, khung xem nhanh bị nhốt trong vùng nội dung,
 * lộ viền tối và không phủ được sidebar.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
