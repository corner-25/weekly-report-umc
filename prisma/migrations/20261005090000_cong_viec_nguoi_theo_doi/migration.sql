-- Người theo dõi công việc (cột "Người theo dõi" ở phân hệ Quản lý công việc).
ALTER TABLE "work_items" ADD COLUMN "watchers" TEXT[] DEFAULT ARRAY[]::TEXT[];
