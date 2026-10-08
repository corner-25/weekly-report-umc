-- Danh sách khách khám chữa bệnh (khách VIP Phòng HC dẫn khám) trong CRM.
ALTER TABLE "crm_contacts" ADD COLUMN "address" TEXT, ADD COLUMN "patientCode" TEXT;
CREATE INDEX "crm_contacts_patientCode_idx" ON "crm_contacts"("patientCode");

ALTER TABLE "crm_interactions" ADD COLUMN "referrer" TEXT,
  ADD COLUMN "visitKind" TEXT,
  ADD COLUMN "followUp" TEXT,
  ADD COLUMN "followUpDate" TIMESTAMP(3),
  ADD COLUMN "visitItems" JSONB;
CREATE INDEX "crm_interactions_followUpDate_idx" ON "crm_interactions"("followUpDate");

-- Chatbot: thống kê dẫn khám KHÔNG có danh tính, chẩn đoán — chỉ ngày, chuyên khoa, người giới thiệu, khám mới/tái khám.
CREATE OR REPLACE VIEW v_chatbot_vip_escorts AS
SELECT i.id AS record_id,
  (i."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS visit_date,
  EXTRACT(year FROM i."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS visit_year,
  EXTRACT(month FROM i."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS visit_month,
  i.destination AS specialties,
  i.referrer,
  i."visitKind" AS visit_kind,
  cardinality(i.services) AS service_count,
  i."timeText" AS session
FROM crm_interactions i
WHERE i.type = 'VIP_ESCORT' AND i.status = 'DONE';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_readonly') THEN
    GRANT SELECT ON v_chatbot_vip_escorts TO chatbot_readonly;
  END IF;
END $$;
