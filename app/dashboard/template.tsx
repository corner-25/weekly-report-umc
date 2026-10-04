/**
 * Template dựng lại mỗi lần đổi trang (khác layout), nên nội dung trang mới hiện
 * lên nhẹ nhàng thay vì bật ngang. Sidebar nằm ở layout nên đứng yên.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
