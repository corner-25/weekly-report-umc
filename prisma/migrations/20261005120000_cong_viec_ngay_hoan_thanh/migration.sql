-- Ngày hoàn thành của công việc: tính tỷ lệ đúng hạn và thời gian xử lý trên bảng điều hành.
ALTER TABLE "work_items" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Việc đã xong từ trước: tạm lấy lần cập nhật cuối; lần cào sau ghi đè bằng ngày hoàn thành ở nguồn.
UPDATE "work_items" SET "completedAt" = COALESCE("lastActivityAt", "updatedAt") WHERE "status" = 'DONE';

CREATE INDEX "work_items_completedAt_idx" ON "work_items"("completedAt");
