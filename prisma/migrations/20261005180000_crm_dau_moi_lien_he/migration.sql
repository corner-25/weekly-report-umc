-- Đầu mối liên hệ của tổ chức: đánh dấu trên chức vụ (người — tổ chức).
ALTER TABLE "crm_positions" ADD COLUMN "isFocalPoint" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "crm_positions_organizationId_isFocalPoint_idx" ON "crm_positions"("organizationId", "isFocalPoint");
