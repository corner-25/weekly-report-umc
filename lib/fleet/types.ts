// ==================== FLEET DASHBOARD TYPES ====================

/** Column mapping from Vietnamese to English */
export const COLUMN_MAPPING: Record<string, string | null> = {
  'Timestamp': null,
  'Email Address': null,
  'Ghi chú': null,
  'Chỉ số đồng hồ sau khi kết thúc chuyến xe': null,
  'start_time': 'start_time',
  'end_time': 'end_time',
  'Thời gian': 'duration_hours',
  'Điểm đến': 'destination',
  'Phân loại công tác': 'work_category',
  'Nội thành/ngoại thành': 'area_type',
  'Ngày ghi nhận': 'record_date',
  'Quãng đường': 'distance_km',
  'Đổ nhiên liệu': 'fuel_liters',
  'Doanh thu': 'revenue_vnd',
  'Chi tiết chuyến xe': 'trip_details',
  'Mã xe': 'vehicle_id',
  'Tên tài xế': 'driver_name',
  'Loại xe': 'vehicle_type',
};

/** Fuel standards per vehicle (L/100km) */
export const FUEL_STANDARDS: Record<string, number> = {
  'CT_50M-004.37': 18,
  'CT_50M-002.19': 18,
  'CT_50A-009.44': 16,
  'CT_50A-007.39': 16,
  'CT_50A-010.67': 17,
  'CT_50A-018.35': 15,
  'CT_51B-509.51': 17,
  'CT_50A-019.90': 13,
  'HC_50A-007.20': 20,
  'HC_50A-004.55': 22,
  'HC_50A-012.59': 10,
  'HC_51B-330.67': 29,
};

/** A single trip record after processing */
export interface FleetTrip {
  vehicle_id: string;
  driver_name: string;
  vehicle_type: string;       // 'Hành chính' | 'Cứu thương'
  record_date: string;        // ISO date string
  start_time: string | null;
  end_time: string | null;
  duration_hours: number;
  distance_km: number;
  fuel_liters: number;
  revenue_vnd: number;
  destination: string;
  work_category: string;
  area_type: string;          // 'Nội thành' | 'Ngoại thành'
  trip_details: string;
  // computed
  date: string;               // YYYY-MM-DD
  month: string;              // YYYY-MM
  weekday: number;            // 0=Sun..6=Sat
}

/** Overview metrics */
export interface FleetOverview {
  totalTrips: number;
  totalVehicles: number;
  totalDrivers: number;
  totalRevenue: number;
  totalHours: number;
  totalDistance: number;
  avgRevenuePerTrip: number;
  avgHoursPerTrip: number;
  avgTripsPerDay: number;
  activeDays: number;
  peakDayTrips: number;
  peakDate: string;
}

/** Per-vehicle stats */
export interface VehicleStats {
  vehicle_id: string;
  vehicle_type: string;
  totalTrips: number;
  totalRevenue: number;
  totalHours: number;
  totalDistance: number;
  totalFuel: number;
  activeDays: number;
  tripsPerDay: number;
  hoursPerTrip: number;
  distancePerTrip: number;
  revenuePerHour: number;
  fuelPer100km: number;
  fuelStandard: number | null;
  fuelDeviation: number;
  fuelStatus: 'over' | 'ok' | 'efficient' | 'no_data' | 'no_standard';
  performance: 'Cao' | 'Trung bình' | 'Thấp';
}

/** Per-driver stats */
export interface DriverStats {
  driver_name: string;
  totalTrips: number;
  totalRevenue: number;
  totalHours: number;
  activeDays: number;
  tripsPerDay: number;
  hoursPerDay: number;
}

/** Daily aggregation */
export interface DailyStats {
  date: string;
  totalTrips: number;
  totalRevenue: number;
  totalDistance: number;
  totalHours: number;
  activeVehicles: number;
  hcVehicles: number;
  ctVehicles: number;
}

/** Date filter */
export interface FleetDateFilter {
  startDate: string;
  endDate: string;
}

/** Vehicle type filter */
export type VehicleTypeFilter = 'all' | 'Hành chính' | 'Cứu thương';

/** Tab type */
export type FleetTab = 'overview' | 'revenue' | 'vehicles' | 'distance' | 'fuel' | 'report';
