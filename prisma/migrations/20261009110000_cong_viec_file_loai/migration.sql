-- Phân loại file đính kèm công việc: của việc, kèm tiến độ, kết quả, hay trong trao đổi/phản hồi.
ALTER TABLE "work_attachments" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TASK', ADD COLUMN "sourceRefId" TEXT;
