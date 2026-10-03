/** Dữ liệu trang Tổng quan, trả về từ `/api/dashboard-stats` (ngày tháng ở dạng chuỗi ISO). */

export interface DashboardEvent {
  id: string;
  name: string;
  date: string;
  time: string | null;
  status: string;
  meetingRoom: { name: string } | null;
}

export interface DashboardWeek {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  status: string;
  taskCount: number;
}

export interface DashboardBirthday {
  id: string;
  fullName: string;
  birthdayDay: number;
  birthdayMonth: number;
  age: number;
  isToday: boolean;
}

export interface DashboardSecretaryType {
  typeId: string | null;
  name: string;
  color: string;
  count: number;
}

export interface DashboardTransfer {
  id: string;
  transferDate: string;
  secretary: { fullName: string } | null;
  fromDepartment: { name: string } | null;
  toDepartment: { name: string } | null;
}

export interface DashboardMou {
  id: string;
  title: string;
  mouNumber: string | null;
  partnerName: string;
  expiryDate: string;
  status: string;
}

export interface DashboardStats {
  totalMasterTasks: number;
  tasksInProgress: number;
  tasksCompleted: number;
  totalWeeks: number;
  recentWeeks: DashboardWeek[];
  upcomingEvents: DashboardEvent[];
  todayEvents: DashboardEvent[];
  totalMeetingRooms: number;
  totalSecretaries: number;
  activeSecretaries: number;
  secretariesByType: DashboardSecretaryType[];
  birthdaySecretaries: DashboardBirthday[];
  birthdayPreview: DashboardBirthday[];
  recentTransfers: DashboardTransfer[];
  expiringMOUs: DashboardMou[];
}
