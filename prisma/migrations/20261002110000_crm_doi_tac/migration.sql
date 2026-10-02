-- CRM đối tác: thay module Khách VIP bằng danh bạ cá nhân/tổ chức, hồ sơ 360°,
-- ngày quan trọng và dòng thời gian tương tác (tiếp đón, dẫn khám, dẫn đoàn…).
--
-- Hai bảng VIP cũ đang RỖNG trên production (đã kiểm tra 02/10/2026) nên xoá
-- thẳng, không cần chép dữ liệu. View chatbot v_chatbot_vip_summary đang đọc
-- chúng: tạo lại trên crm_interactions, giữ nguyên tên và thứ tự cột.

DROP VIEW IF EXISTS v_chatbot_vip_summary;
DROP TABLE IF EXISTS "vip_guest_visits";
DROP TABLE IF EXISTS "vip_organizations";

-- CreateEnum
CREATE TYPE "CrmTier" AS ENUM ('VIP', 'A', 'B', 'C');

-- CreateEnum
CREATE TYPE "CrmOrganizationType" AS ENUM ('HOSPITAL', 'UNIVERSITY', 'COMPANY', 'GOVERNMENT', 'INTERNATIONAL', 'PRESS', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmContactStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CrmRelationKind" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'ASSISTANT', 'SECRETARY', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmDateKind" AS ENUM ('BIRTHDAY', 'APPOINTMENT', 'FOUNDING', 'ANNIVERSARY', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmInteractionType" AS ENUM ('VIP_ESCORT', 'DELEGATION', 'MEETING', 'CALL', 'EMAIL', 'EVENT', 'GIFT', 'OTHER');

-- CreateTable
CREATE TABLE "crm_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type" "CrmOrganizationType" NOT NULL DEFAULT 'OTHER',
    "tier" "CrmTier" NOT NULL DEFAULT 'C',
    "address" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "ownerName" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contacts" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "academicTitle" TEXT,
    "salutation" TEXT,
    "gender" TEXT,
    "birthDay" INTEGER,
    "birthMonth" INTEGER,
    "birthYear" INTEGER,
    "birthIsLunar" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "email" TEXT,
    "giftAddress" TEXT,
    "tier" "CrmTier" NOT NULL DEFAULT 'C',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerName" TEXT,
    "preferences" JSONB,
    "sensitiveNote" TEXT,
    "status" "CrmContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_positions" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_relations" (
    "id" TEXT NOT NULL,
    "fromContactId" TEXT NOT NULL,
    "toContactId" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "kind" "CrmRelationKind" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_important_dates" (
    "id" TEXT NOT NULL,
    "contactId" TEXT,
    "organizationId" TEXT,
    "kind" "CrmDateKind" NOT NULL,
    "label" TEXT,
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER,
    "isLunar" BOOLEAN NOT NULL DEFAULT false,
    "repeatsYearly" BOOLEAN NOT NULL DEFAULT true,
    "remindDaysBefore" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_important_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_interactions" (
    "id" TEXT NOT NULL,
    "type" "CrmInteractionType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT,
    "organizationId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "destination" TEXT,
    "patientName" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guestCount" INTEGER,
    "purpose" TEXT,
    "staffName" TEXT NOT NULL,
    "companions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hospitalEventId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_interaction_participants" (
    "interactionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "crm_interaction_participants_pkey" PRIMARY KEY ("interactionId","contactId")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_organizations_normalizedName_key" ON "crm_organizations"("normalizedName");

-- CreateIndex
CREATE INDEX "crm_organizations_tier_idx" ON "crm_organizations"("tier");

-- CreateIndex
CREATE INDEX "crm_contacts_fullName_idx" ON "crm_contacts"("fullName");

-- CreateIndex
CREATE INDEX "crm_contacts_tier_idx" ON "crm_contacts"("tier");

-- CreateIndex
CREATE INDEX "crm_contacts_birthMonth_birthDay_idx" ON "crm_contacts"("birthMonth", "birthDay");

-- CreateIndex
CREATE INDEX "crm_positions_contactId_idx" ON "crm_positions"("contactId");

-- CreateIndex
CREATE INDEX "crm_positions_organizationId_idx" ON "crm_positions"("organizationId");

-- CreateIndex
CREATE INDEX "crm_relations_fromContactId_idx" ON "crm_relations"("fromContactId");

-- CreateIndex
CREATE INDEX "crm_important_dates_contactId_idx" ON "crm_important_dates"("contactId");

-- CreateIndex
CREATE INDEX "crm_important_dates_organizationId_idx" ON "crm_important_dates"("organizationId");

-- CreateIndex
CREATE INDEX "crm_important_dates_month_day_idx" ON "crm_important_dates"("month", "day");

-- CreateIndex
CREATE INDEX "crm_interactions_occurredAt_idx" ON "crm_interactions"("occurredAt");

-- CreateIndex
CREATE INDEX "crm_interactions_type_occurredAt_idx" ON "crm_interactions"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "crm_interactions_contactId_idx" ON "crm_interactions"("contactId");

-- CreateIndex
CREATE INDEX "crm_interactions_organizationId_idx" ON "crm_interactions"("organizationId");

-- CreateIndex
CREATE INDEX "crm_interaction_participants_contactId_idx" ON "crm_interaction_participants"("contactId");

-- AddForeignKey
ALTER TABLE "crm_positions" ADD CONSTRAINT "crm_positions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_positions" ADD CONSTRAINT "crm_positions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "crm_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relations" ADD CONSTRAINT "crm_relations_fromContactId_fkey" FOREIGN KEY ("fromContactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_relations" ADD CONSTRAINT "crm_relations_toContactId_fkey" FOREIGN KEY ("toContactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_important_dates" ADD CONSTRAINT "crm_important_dates_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_important_dates" ADD CONSTRAINT "crm_important_dates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "crm_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "crm_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_interaction_participants" ADD CONSTRAINT "crm_interaction_participants_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "crm_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_interaction_participants" ADD CONSTRAINT "crm_interaction_participants_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lượt tiếp đón VIP và dẫn đoàn theo ngày, như view cũ (mỗi ngày × đơn vị × nơi đến một dòng).
CREATE OR REPLACE VIEW v_chatbot_vip_summary AS
SELECT min(i.id) AS record_id,
       i."occurredAt"::date AS visit_date,
       COALESCE(o.name, 'Không rõ đơn vị') AS organization_name,
       i.destination,
       count(*)::integer AS visit_count
FROM crm_interactions i
LEFT JOIN crm_organizations o ON o.id = i."organizationId"
WHERE i.type IN ('VIP_ESCORT', 'DELEGATION')
GROUP BY i."occurredAt"::date, COALESCE(o.name, 'Không rõ đơn vị'), i.destination;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_readonly') THEN
    GRANT SELECT ON v_chatbot_vip_summary TO chatbot_readonly;
  END IF;
END $$;
