-- Bổ sung metadata cách tính giờ lái cho fleet_trips.
--
-- Logic tính giờ lái đã nâng cấp: phân biệt nhầm AM/PM (+12h) với qua đêm thật
-- (+24h), và kiểm tra chéo bằng quãng đường. Hai cột này ghi lại cách tính và
-- mức tin cậy để dashboard lọc được và người vận hành truy vết.
--
-- Bỏ isDuplicate: chuyến nghi trùng nay bị loại ngay ở parser (giữ bản đầu,
-- giống keep='first' của bản Python) nên cột này không còn ý nghĩa.

ALTER TABLE "fleet_trips"
  ADD COLUMN IF NOT EXISTS "durationConfidence" TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "durationMethod" TEXT NOT NULL DEFAULT 'normal';

DROP INDEX IF EXISTS "fleet_trips_isDuplicate_idx";

ALTER TABLE "fleet_trips" DROP COLUMN IF EXISTS "isDuplicate";
