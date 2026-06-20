// Smart duration normalization for fleet trips.
//
// Source sheets sometimes carry obvious quirks:
//   - End time earlier in the day than start time, but the AM/PM marker
//     stayed identical (e.g. 8:00 AM → 2:00 AM means "next day 2 AM").
//   - Long-haul trips where the recorded duration is much smaller than the
//     distance suggests (e.g. 651 km in 6 hours).
//
// This module exposes a single helper that:
//   1. Parses a time string into a fractional-hour value.
//   2. Computes a raw duration, rolling end past midnight when needed.
//   3. If the raw duration is too short for the distance, snaps to a
//      whole-day bucket (8 / 16 / 24 / 32 hours = 1 / 2 / 3 / 4 work days)
//      using the 600 km/day mapping.
//
// The function returns both the normalized hours and an audit flag so the
// dashboard can show the user which trips were adjusted.

export type DurationAdjustment =
  | 'NONE'             // raw duration kept as-is
  | 'ROLLED_OVERNIGHT' // end_time < start_time was treated as next-day
  | 'SNAPPED_TO_DAY'   // duration overridden by the km/day mapping
  | 'BOTH';            // overnight roll + km-day snap

export interface NormalizedDuration {
  hours: number;
  adjustment: DurationAdjustment;
  raw: {
    /** Hours computed directly from start_time/end_time, before any snapping. */
    rawHours: number | null;
    /** Hours as reported by the source (whatever the sheet had in duration). */
    reportedHours: number;
    /** Whether end_time < start_time triggered an overnight roll. */
    overnight: boolean;
    /** Whether the km/day rule kicked in. */
    snapped: boolean;
  };
}

// 600 km == 1 work day == 8 h. Update once for the whole pipeline.
const KM_PER_DAY = 600;
const HOURS_PER_DAY = 8;

// Speed sanity check: trips below this average speed but above a generous
// distance threshold are considered "too short" and get snapped. Without this
// check we'd snap perfectly normal city trips that happen to be 80 km in 90
// minutes.
const SUSPECT_AVG_SPEED_KMH = 50;
const MIN_DISTANCE_FOR_SNAP = 200; // km

/** Convert "8:00:00 AM" / "14:30" / "2 PM" to fractional hours [0, 24). */
function parseTimeToHours(value: string | null | undefined): number | null {
  if (!value) return null;
  let s = String(value).trim();
  if (!s) return null;
  const ampmMatch = s.match(/(am|pm)\s*$/i);
  const ampm = ampmMatch ? ampmMatch[1].toLowerCase() : null;
  if (ampm) s = s.slice(0, ampmMatch?.index ?? s.length).trim();
  const parts = s.split(':').map((p) => p.trim());
  if (parts.length === 0) return null;
  const hh = Number(parts[0]);
  const mm = parts.length > 1 ? Number(parts[1]) : 0;
  const ss = parts.length > 2 ? Number(parts[2]) : 0;
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  let hours = hh + mm / 60 + ss / 3600;
  if (ampm === 'am') {
    if (hh === 12) hours -= 12;
  } else if (ampm === 'pm') {
    if (hh !== 12) hours += 12;
  }
  if (hours < 0 || hours >= 24) {
    // Be permissive — clamp to [0, 24).
    hours = ((hours % 24) + 24) % 24;
  }
  return hours;
}

/** Snap duration to the next whole work-day bucket based on distance. */
function snapToWorkDayBucket(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return HOURS_PER_DAY;
  const days = Math.max(1, Math.ceil(distanceKm / KM_PER_DAY));
  return days * HOURS_PER_DAY;
}

export interface NormalizeArgs {
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  distanceKm: number;
  reportedHours: number;
}

export function normalizeDuration(args: NormalizeArgs): NormalizedDuration {
  const startHours = parseTimeToHours(args.startTime);
  const endHours = parseTimeToHours(args.endTime);

  let overnight = false;
  let rawHours: number | null = null;
  if (startHours !== null && endHours !== null) {
    let endAdjusted = endHours;
    if (endHours <= startHours) {
      // Treat as crossing midnight: 8 AM → 2 AM means 18 hours, not -6.
      endAdjusted = endHours + 24;
      overnight = true;
    }
    rawHours = Math.round((endAdjusted - startHours) * 100) / 100;
  }

  // Use the most "trustworthy" baseline we have: the raw start/end diff when
  // available, otherwise whatever the sheet reported.
  const baseline =
    rawHours !== null && rawHours > 0 && rawHours <= 48
      ? rawHours
      : args.reportedHours > 0 && args.reportedHours <= 48
        ? args.reportedHours
        : 0;

  // Decide whether to snap to a whole-day bucket. Trips >= KM_PER_DAY (600 km)
  // always snap so the work-day rule is consistent. Shorter trips only snap
  // when the implied average speed is unrealistic (data entry mistake).
  let snapped = false;
  let hours = baseline;
  const distance = args.distanceKm;
  if (distance >= KM_PER_DAY) {
    const snappedHours = snapToWorkDayBucket(distance);
    if (snappedHours !== Math.round(baseline * 100) / 100) {
      hours = snappedHours;
      snapped = true;
    }
  } else if (distance >= MIN_DISTANCE_FOR_SNAP) {
    const avgSpeed = baseline > 0 ? distance / baseline : Infinity;
    if (baseline === 0 || avgSpeed > SUSPECT_AVG_SPEED_KMH) {
      const snappedHours = snapToWorkDayBucket(distance);
      if (snappedHours > baseline) {
        hours = snappedHours;
        snapped = true;
      }
    }
  }

  let adjustment: DurationAdjustment = 'NONE';
  if (overnight && snapped) adjustment = 'BOTH';
  else if (overnight) adjustment = 'ROLLED_OVERNIGHT';
  else if (snapped) adjustment = 'SNAPPED_TO_DAY';

  return {
    hours: Math.round(hours * 100) / 100,
    adjustment,
    raw: {
      rawHours,
      reportedHours: args.reportedHours,
      overnight,
      snapped,
    },
  };
}
