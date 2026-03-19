import {
  COLUMN_MAPPING,
  FUEL_STANDARDS,
  type FleetTrip,
  type FleetOverview,
  type VehicleStats,
  type DriverStats,
  type DailyStats,
} from './types';

// ─── PARSING ────────────────────────────────────────────────

function parseDuration(val: unknown): number {
  if (val == null || val === '') return 0;
  const s = String(val).trim().replace(/(AM|PM)/gi, '').trim();
  const parts = s.split(':');
  if (parts.length === 2) return Number(parts[0]) + Number(parts[1]) / 60;
  if (parts.length === 3) return Number(parts[0]) + Number(parts[1]) / 60 + Number(parts[2]) / 3600;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function parseDistance(val: unknown): number {
  if (val == null || val === '') return 0;
  let s = String(val).toLowerCase().trim();
  for (const u of ['km', 'kilomet', 'kilometer', 'metre', 'meter', 'm']) s = s.replace(u, '');
  // Vietnamese: "1.234,5" -> remove thousand dots, comma->dot
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  s = s.replace(/,/g, '').replace(/ /g, '');
  const dist = Number(s);
  if (isNaN(dist)) return 0;
  // Convert metres to km
  const km = dist > 1000 && dist < 1000000 ? dist / 1000 : dist;
  return km > 0 && km <= 1000 ? Math.round(km * 100) / 100 : 0;
}

function parseRevenue(val: unknown): number {
  if (val == null || val === '') return 0;
  let s = String(val).trim().replace(/VNĐ|đ|VND/gi, '').replace(/,/g, '').trim();
  const n = Number(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

function parseFuel(val: unknown): number {
  const n = Number(val);
  return isNaN(n) || n < 0 ? 0 : n;
}

function parseDate(val: unknown): string | null {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  // Try various formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  // mm/dd/yyyy
  const parts = s.split('/');
  if (parts.length === 3) {
    const [a, b, y] = parts;
    // Try mm/dd/yyyy first
    const d1 = new Date(Number(y), Number(a) - 1, Number(b));
    if (!isNaN(d1.getTime())) return d1.toISOString().split('T')[0];
    // Try dd/mm/yyyy
    const d2 = new Date(Number(y), Number(b) - 1, Number(a));
    if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
  }
  return null;
}

// ─── DATA PROCESSING ────────────────────────────────────────

export function processRawData(rawRecords: Record<string, unknown>[]): FleetTrip[] {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) return [];

  return rawRecords
    .map((raw) => {
      // Apply column mapping
      const mapped: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(raw)) {
        // Find matching mapping
        let mappedKey: string | null = null;
        for (const [vietCol, engCol] of Object.entries(COLUMN_MAPPING)) {
          if (key.includes(vietCol) || key === vietCol) {
            mappedKey = engCol;
            break;
          }
        }
        if (mappedKey) {
          mapped[mappedKey] = val;
        } else if (key in COLUMN_MAPPING) {
          // Skip null-mapped columns
        } else {
          mapped[key] = val;
        }
      }

      // Also check if columns are already in English
      for (const engCol of Object.values(COLUMN_MAPPING)) {
        if (engCol && engCol in raw && !(engCol in mapped)) {
          mapped[engCol] = raw[engCol];
        }
      }

      const dateStr = parseDate(mapped['record_date']);
      const vehicleId = String(mapped['vehicle_id'] ?? '').trim();
      const vehicleType = String(mapped['vehicle_type'] ?? '').trim();

      // Prefix vehicle_id based on type
      let prefixedId = vehicleId;
      if (vehicleType === 'Hành chính' && !vehicleId.startsWith('HC_')) {
        prefixedId = `HC_${vehicleId}`;
      } else if (vehicleType === 'Cứu thương' && !vehicleId.startsWith('CT_')) {
        prefixedId = `CT_${vehicleId}`;
      }

      const trip: FleetTrip = {
        vehicle_id: prefixedId,
        driver_name: String(mapped['driver_name'] ?? '').trim(),
        vehicle_type: vehicleType,
        record_date: dateStr ?? '',
        start_time: mapped['start_time'] ? String(mapped['start_time']) : null,
        end_time: mapped['end_time'] ? String(mapped['end_time']) : null,
        duration_hours: parseDuration(mapped['duration_hours']),
        distance_km: parseDistance(mapped['distance_km']),
        fuel_liters: parseFuel(mapped['fuel_liters']),
        revenue_vnd: parseRevenue(mapped['revenue_vnd']),
        destination: String(mapped['destination'] ?? ''),
        work_category: String(mapped['work_category'] ?? ''),
        area_type: String(mapped['area_type'] ?? ''),
        trip_details: String(mapped['trip_details'] ?? ''),
        date: dateStr ?? '',
        month: dateStr ? dateStr.substring(0, 7) : '',
        weekday: dateStr ? new Date(dateStr).getDay() : 0,
      };

      return trip;
    })
    .filter((t) => t.vehicle_id && t.vehicle_id !== 'undefined' && t.vehicle_id !== 'nan');
}

// ─── FILTERING ──────────────────────────────────────────────

export function filterByDateRange(data: FleetTrip[], startDate: string, endDate: string): FleetTrip[] {
  return data.filter((t) => {
    if (!t.date) return true; // keep records with invalid dates
    return t.date >= startDate && t.date <= endDate;
  });
}

export function filterByVehicleType(data: FleetTrip[], type: string): FleetTrip[] {
  if (type === 'all') return data;
  return data.filter((t) => t.vehicle_type === type);
}

export function getDateRange(data: FleetTrip[]): { min: string; max: string } {
  const validDates = data.map((t) => t.date).filter(Boolean).sort();
  return {
    min: validDates[0] ?? new Date().toISOString().split('T')[0],
    max: validDates[validDates.length - 1] ?? new Date().toISOString().split('T')[0],
  };
}

// ─── OVERVIEW STATS ─────────────────────────────────────────

export function computeOverview(data: FleetTrip[]): FleetOverview {
  const totalTrips = data.length;
  const vehicles = new Set(data.map((t) => t.vehicle_id).filter(Boolean));
  const drivers = new Set(
    data.map((t) => t.driver_name).filter((n) => n && n !== 'nan' && n !== 'NaN' && n.trim())
  );
  const totalRevenue = data.reduce((s, t) => s + t.revenue_vnd, 0);
  const validHours = data.filter((t) => t.duration_hours >= 0 && t.duration_hours <= 24);
  const totalHours = validHours.reduce((s, t) => s + t.duration_hours, 0);
  const totalDistance = data.reduce((s, t) => s + t.distance_km, 0);
  const revenueTrips = data.filter((t) => t.revenue_vnd > 0);
  const avgRevenuePerTrip = revenueTrips.length > 0
    ? revenueTrips.reduce((s, t) => s + t.revenue_vnd, 0) / revenueTrips.length
    : 0;
  const avgHoursPerTrip = validHours.length > 0 ? totalHours / validHours.length : 0;

  // Daily aggregation
  const dailyCounts: Record<string, number> = {};
  for (const t of data) {
    if (t.date) dailyCounts[t.date] = (dailyCounts[t.date] || 0) + 1;
  }
  const dates = Object.keys(dailyCounts);
  const activeDays = dates.length;
  const avgTripsPerDay = activeDays > 0 ? totalTrips / activeDays : 0;

  let peakDayTrips = 0;
  let peakDate = '';
  for (const [date, count] of Object.entries(dailyCounts)) {
    if (count > peakDayTrips) {
      peakDayTrips = count;
      peakDate = date;
    }
  }

  return {
    totalTrips, totalVehicles: vehicles.size, totalDrivers: drivers.size,
    totalRevenue, totalHours, totalDistance,
    avgRevenuePerTrip, avgHoursPerTrip, avgTripsPerDay,
    activeDays, peakDayTrips, peakDate,
  };
}

// ─── VEHICLE STATS ──────────────────────────────────────────

export function computeVehicleStats(data: FleetTrip[]): VehicleStats[] {
  const validDates = data.filter((t) => t.date).map((t) => t.date).sort();
  const totalDays = validDates.length >= 2
    ? Math.max(1, Math.ceil((new Date(validDates[validDates.length - 1]).getTime() - new Date(validDates[0]).getTime()) / 86400000) + 1)
    : 30;

  const grouped: Record<string, FleetTrip[]> = {};
  for (const t of data) {
    (grouped[t.vehicle_id] ??= []).push(t);
  }

  return Object.entries(grouped).map(([vehicleId, trips]) => {
    const totalTrips = trips.length;
    const totalRevenue = trips.reduce((s, t) => s + t.revenue_vnd, 0);
    const validH = trips.filter((t) => t.duration_hours >= 0 && t.duration_hours <= 24);
    const totalHours = validH.reduce((s, t) => s + t.duration_hours, 0);
    const totalDistance = trips.reduce((s, t) => s + t.distance_km, 0);
    const totalFuel = trips.reduce((s, t) => s + t.fuel_liters, 0);
    const activeDays = new Set(trips.map((t) => t.date).filter(Boolean)).size;
    const tripsPerDay = activeDays > 0 ? totalTrips / activeDays : 0;
    const hoursPerTrip = totalTrips > 0 ? totalHours / totalTrips : 0;
    const distancePerTrip = totalTrips > 0 ? totalDistance / totalTrips : 0;
    const revenuePerHour = totalHours > 0 ? totalRevenue / totalHours : 0;
    const fuelPer100km = totalDistance > 0 && totalFuel > 0 ? (totalFuel / totalDistance) * 100 : 0;
    const fuelStandard = FUEL_STANDARDS[vehicleId] ?? null;
    const fuelDeviation = fuelStandard && fuelPer100km > 0 ? fuelPer100km - fuelStandard : 0;
    const utilization = totalDays > 0 ? (activeDays / totalDays) * 100 : 0;

    let fuelStatus: VehicleStats['fuelStatus'] = 'no_data';
    if (fuelStandard === null) fuelStatus = 'no_standard';
    else if (fuelPer100km === 0) fuelStatus = 'no_data';
    else if (fuelDeviation > 2) fuelStatus = 'over';
    else if (fuelDeviation < -1) fuelStatus = 'efficient';
    else fuelStatus = 'ok';

    let performance: VehicleStats['performance'] = 'Thấp';
    if (tripsPerDay >= 2 && utilization >= 70) performance = 'Cao';
    else if (tripsPerDay >= 1 && utilization >= 50) performance = 'Trung bình';

    return {
      vehicle_id: vehicleId,
      vehicle_type: trips[0]?.vehicle_type ?? '',
      totalTrips, totalRevenue, totalHours, totalDistance, totalFuel, activeDays,
      tripsPerDay: Math.round(tripsPerDay * 10) / 10,
      hoursPerTrip: Math.round(hoursPerTrip * 10) / 10,
      distancePerTrip: Math.round(distancePerTrip * 10) / 10,
      revenuePerHour: Math.round(revenuePerHour),
      fuelPer100km: Math.round(fuelPer100km * 100) / 100,
      fuelStandard, fuelDeviation: Math.round(fuelDeviation * 100) / 100,
      fuelStatus, performance,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ─── DRIVER STATS ───────────────────────────────────────────

export function computeDriverStats(data: FleetTrip[]): DriverStats[] {
  const grouped: Record<string, FleetTrip[]> = {};
  for (const t of data) {
    const name = t.driver_name;
    if (!name || name === 'nan' || name === 'NaN' || !name.trim()) continue;
    (grouped[name] ??= []).push(t);
  }

  return Object.entries(grouped).map(([name, trips]) => {
    const totalTrips = trips.length;
    const totalRevenue = trips.reduce((s, t) => s + t.revenue_vnd, 0);
    const validH = trips.filter((t) => t.duration_hours >= 0 && t.duration_hours <= 24);
    const totalHours = validH.reduce((s, t) => s + t.duration_hours, 0);
    const activeDays = new Set(trips.map((t) => t.date).filter(Boolean)).size;
    return {
      driver_name: name,
      totalTrips, totalRevenue, totalHours: Math.round(totalHours * 10) / 10,
      activeDays,
      tripsPerDay: activeDays > 0 ? Math.round((totalTrips / activeDays) * 10) / 10 : 0,
      hoursPerDay: activeDays > 0 ? Math.round((totalHours / activeDays) * 10) / 10 : 0,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ─── DAILY STATS ────────────────────────────────────────────

export function computeDailyStats(data: FleetTrip[]): DailyStats[] {
  const grouped: Record<string, FleetTrip[]> = {};
  for (const t of data) {
    if (t.date) (grouped[t.date] ??= []).push(t);
  }

  return Object.entries(grouped)
    .map(([date, trips]) => ({
      date,
      totalTrips: trips.length,
      totalRevenue: trips.reduce((s, t) => s + t.revenue_vnd, 0),
      totalDistance: trips.reduce((s, t) => s + t.distance_km, 0),
      totalHours: trips.reduce((s, t) => s + t.duration_hours, 0),
      activeVehicles: new Set(trips.map((t) => t.vehicle_id)).size,
      hcVehicles: new Set(trips.filter((t) => t.vehicle_type === 'Hành chính').map((t) => t.vehicle_id)).size,
      ctVehicles: new Set(trips.filter((t) => t.vehicle_type === 'Cứu thương').map((t) => t.vehicle_id)).size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── FORMAT HELPERS ─────────────────────────────────────────

export function formatVND(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

export function formatVNDFull(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

export function formatKm(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
}

export function formatHours(value: number): string {
  return value.toFixed(1);
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}
