-- Dấu vân tay nội dung báo cáo từng phòng mỗi tuần, để nạp lại khi sheet được sửa.
CREATE TABLE "hospital_import_snapshots" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "departmentId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "taskCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_import_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hospital_import_snapshots_year_week_departmentId_key" ON "hospital_import_snapshots"("year", "week", "departmentId");
