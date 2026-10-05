-- Sổ tiếp đoàn 2022–2026: trạng thái Hoãn, mã tổ chức/đoàn để nạp lại không trùng,
-- và các trường của sổ (đơn vị chủ trì, thành phần, chủ đề, quà, cần xác minh…).
ALTER TYPE "CrmInteractionStatus" ADD VALUE IF NOT EXISTS 'POSTPONED' BEFORE 'CANCELLED';

ALTER TABLE "crm_organizations"
  ADD COLUMN "externalCode" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "scope" TEXT,
  ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX "crm_organizations_externalCode_key" ON "crm_organizations"("externalCode");

ALTER TABLE "crm_interactions"
  ADD COLUMN "externalCode" TEXT,
  ADD COLUMN "endAt" TIMESTAMP(3),
  ADD COLUMN "timeText" TEXT,
  ADD COLUMN "dateUnknown" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "incomingDocNo" TEXT,
  ADD COLUMN "hostUnit" TEXT,
  ADD COLUMN "hostDepartmentId" TEXT,
  ADD COLUMN "hospitalAttendees" TEXT,
  ADD COLUMN "guestMembers" TEXT,
  ADD COLUMN "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "coOrganizations" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "purposeInferred" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "giftsGiven" TEXT,
  ADD COLUMN "giftsReceived" TEXT,
  ADD COLUMN "cashReceived" INTEGER,
  ADD COLUMN "giftBudget" INTEGER,
  ADD COLUMN "giftActualCost" INTEGER,
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "sourceRef" TEXT;
CREATE UNIQUE INDEX "crm_interactions_externalCode_key" ON "crm_interactions"("externalCode");
CREATE INDEX "crm_interactions_hostDepartmentId_idx" ON "crm_interactions"("hostDepartmentId");
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_hostDepartmentId_fkey"
  FOREIGN KEY ("hostDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
