-- CRM: lịch hẹn dẫn khách (trạng thái lượt tương tác) và tìm kiếm không dấu.
-- Bảng CRM đang rỗng trên production (03/10/2026); cột mới đều có mặc định.
CREATE TYPE "CrmInteractionStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

ALTER TABLE "crm_interactions" ADD COLUMN "status" "CrmInteractionStatus" NOT NULL DEFAULT 'DONE';
CREATE INDEX "crm_interactions_status_occurredAt_idx" ON "crm_interactions"("status", "occurredAt");

ALTER TABLE "crm_contacts" ADD COLUMN "searchKey" TEXT NOT NULL DEFAULT '';
CREATE INDEX "crm_contacts_searchKey_idx" ON "crm_contacts"("searchKey");

ALTER TABLE "crm_organizations" ADD COLUMN "searchKey" TEXT NOT NULL DEFAULT '';
