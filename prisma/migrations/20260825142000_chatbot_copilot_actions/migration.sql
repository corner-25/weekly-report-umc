ALTER TABLE "chatbot_audit_logs"
  ADD COLUMN "contextPath" TEXT,
  ADD COLUMN "feedback" TEXT,
  ADD COLUMN "actionType" TEXT,
  ADD COLUMN "actionStatus" TEXT;

CREATE TYPE "ChatbotActionStatus" AS ENUM ('PENDING', 'EXECUTED', 'EXPIRED', 'REJECTED');

CREATE TABLE "chatbot_action_proposals" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "ChatbotActionStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "executedAt" TIMESTAMP(3),
  "resultId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chatbot_action_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chatbot_action_proposals_userId_status_expiresAt_idx"
  ON "chatbot_action_proposals"("userId", "status", "expiresAt");
CREATE INDEX "chatbot_action_proposals_expiresAt_idx"
  ON "chatbot_action_proposals"("expiresAt");
ALTER TABLE "chatbot_action_proposals"
  ADD CONSTRAINT "chatbot_action_proposals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST', 'STAFF');
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'STAFF';
ALTER TABLE "users" ADD COLUMN "departmentId" TEXT;
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE VIEW v_chatbot_meeting_rooms AS
SELECT id AS record_id, name, location, capacity, description,
  "hasMicrophone" AS has_microphone, "hasSpeaker" AS has_speaker,
  "hasProjector" AS has_projector, "hasScreen" AS has_screen,
  "hasTV" AS has_tv, "hasSmartBoard" AS has_smart_board,
  "hasWifi" AS has_wifi, "hasAircon" AS has_aircon,
  "hasWhiteboard" AS has_whiteboard, "isActive" AS is_active
FROM meeting_rooms WHERE "deletedAt" IS NULL;

CREATE OR REPLACE VIEW v_chatbot_event_checklists AS
SELECT i.id AS record_id, e.id AS event_id, e.name AS event_name,
  e.date AS event_date, i.title, i.description,
  i."isCompleted" AS is_completed, i."completedAt" AS completed_at,
  i."orderNumber" AS order_number
FROM event_checklist_items i JOIN hospital_events e ON e.id = i."hospitalEventId"
WHERE e."deletedAt" IS NULL;

-- VIP visits are aggregated: no guest, phone, contact or staff names.
CREATE OR REPLACE VIEW v_chatbot_vip_summary AS
SELECT min(v.id) AS record_id, v."visitDate"::date AS visit_date,
  COALESCE(o.name, 'Không rõ đơn vị') AS organization_name,
  v.destination, count(*)::int AS visit_count
FROM vip_guest_visits v LEFT JOIN vip_organizations o ON o.id = v."organizationId"
GROUP BY v."visitDate"::date, COALESCE(o.name, 'Không rõ đơn vị'), v.destination;

CREATE OR REPLACE VIEW v_chatbot_mou_details AS
SELECT c.id AS record_id, m.id AS mou_id, m.title AS mou_title,
  'CLAUSE'::text AS detail_type, c.title, c.content,
  c."clauseStatus"::text AS status, c.progress, c.deadline, c.result, c.notes
FROM mou_clauses c JOIN mous m ON m.id = c."mouId" WHERE m."deletedAt" IS NULL
UNION ALL
SELECT a.id, m.id, m.title, 'ACTIVITY', a.title, a.description,
  a.status::text, NULL, a."endDate", a.result, a.notes
FROM mou_activities a JOIN mous m ON m.id = a."mouId" WHERE m."deletedAt" IS NULL;

CREATE OR REPLACE VIEW v_chatbot_license_renewals AS
SELECT r.id AS record_id, l.id AS license_id, l.name AS license_name,
  l."licenseNumber" AS license_number, r."renewedDate" AS renewed_date,
  r."previousExpiry" AS previous_expiry, r."newExpiryDate" AS new_expiry,
  r."decisionNumber" AS decision_number, r.notes
FROM license_renewals r JOIN licenses l ON l.id = r."licenseId"
WHERE l."deletedAt" IS NULL;

CREATE OR REPLACE VIEW v_chatbot_sync_health AS
SELECT r.id AS record_id, s.name AS source_name, s.kind::text AS source_kind,
  r.status::text, r.trigger, r."startedAt" AS started_at,
  r."finishedAt" AS finished_at, r."rowsRead" AS rows_read,
  r."rowsUpserted" AS rows_upserted, r."rowsSkipped" AS rows_skipped,
  r."errorMessage" AS error_message
FROM sync_runs r JOIN sync_sources s ON s.id = r."sourceId";

CREATE OR REPLACE VIEW v_chatbot_import_health AS
SELECT min(id) AS record_id, "sourceId" AS source_id, year, week,
  status::text, count(*)::int AS item_count,
  min("createdAt") AS first_created_at, max("reviewedAt") AS last_reviewed_at
FROM pending_ai_imports GROUP BY "sourceId", year, week, status;

CREATE OR REPLACE VIEW v_chatbot_hc_metrics AS
SELECT id AS record_id, category, content, year, week, month, value FROM hc_metrics;

CREATE OR REPLACE VIEW v_chatbot_extraction_quality AS
SELECT min(id) AS record_id, "extractionModel" AS extraction_model,
  count(*)::int AS task_count,
  round(avg("matchConfidence")::numeric, 3) AS average_confidence,
  count(*) FILTER (WHERE array_length("reviewFlags", 1) > 0)::int AS flagged_count
FROM week_task_progress GROUP BY "extractionModel";

-- Personnel is aggregate-only. Individual records stay behind dedicated UI/API.
CREATE OR REPLACE VIEW v_chatbot_secretary_qualifications AS
SELECT min(s.id) AS record_id, t.name AS secretary_type, d.name AS department_name,
  count(DISTINCT s.id)::int AS secretary_count,
  count(DISTINCT c.id)::int AS certificate_count,
  round(avg(e.total)::numeric, 2) AS average_exam_score
FROM secretaries s
LEFT JOIN secretary_types t ON t.id = s."secretaryTypeId"
LEFT JOIN departments d ON d.id = s."currentDepartmentId"
LEFT JOIN secretary_certificates c ON c."secretaryId" = s.id
LEFT JOIN secretary_exam_scores e ON e."secretaryId" = s.id
WHERE s."deletedAt" IS NULL GROUP BY t.name, d.name;

CREATE OR REPLACE VIEW v_chatbot_secretary_transfers AS
SELECT min(l.id) AS record_id, f.name AS from_department, t.name AS to_department,
  date_trunc('month', l."transferDate")::date AS transfer_month,
  count(*)::int AS transfer_count
FROM secretary_transfer_logs l
LEFT JOIN departments f ON f.id = l."fromDepartmentId"
JOIN departments t ON t.id = l."toDepartmentId"
GROUP BY f.name, t.name, date_trunc('month', l."transferDate")::date;

CREATE OR REPLACE VIEW v_chatbot_recruitment_summary AS
SELECT min(id) AS record_id, status::text, "appliedPosition" AS applied_position,
  "desiredDepartmentId" AS desired_department_id, count(*)::int AS applicant_count,
  round(avg("interviewScore")::numeric, 2) AS average_interview_score
FROM secretary_applications WHERE "deletedAt" IS NULL
GROUP BY status, "appliedPosition", "desiredDepartmentId";

DROP VIEW IF EXISTS v_chatbot_secretaries;
CREATE VIEW v_chatbot_secretaries AS
SELECT min(s.id) AS record_id, s.status::text, t.name AS secretary_type,
  d.name AS current_department, count(*)::int AS secretary_count
FROM secretaries s
LEFT JOIN secretary_types t ON t.id = s."secretaryTypeId"
LEFT JOIN departments d ON d.id = s."currentDepartmentId"
WHERE s."deletedAt" IS NULL GROUP BY s.status, t.name, d.name;

DO $$ DECLARE view_name text; BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_readonly') THEN
    GRANT USAGE ON SCHEMA public TO chatbot_readonly;
    FOREACH view_name IN ARRAY ARRAY[
      'v_chatbot_metrics','v_chatbot_tasks','v_chatbot_mou','v_chatbot_licenses',
      'v_chatbot_events','v_chatbot_secretaries','v_chatbot_vehicles',
      'v_chatbot_maintenance','v_chatbot_fleet_summary','v_chatbot_meeting_rooms',
      'v_chatbot_event_checklists','v_chatbot_vip_summary','v_chatbot_mou_details',
      'v_chatbot_license_renewals','v_chatbot_sync_health','v_chatbot_import_health',
      'v_chatbot_extraction_quality','v_chatbot_hc_metrics',
      'v_chatbot_secretary_qualifications','v_chatbot_secretary_transfers',
      'v_chatbot_recruitment_summary'
    ] LOOP
      IF to_regclass('public.' || view_name) IS NOT NULL THEN
        EXECUTE format('GRANT SELECT ON %I TO chatbot_readonly', view_name);
      END IF;
    END LOOP;
  END IF;
END $$;
