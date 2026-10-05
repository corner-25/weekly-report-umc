-- Luồng = các dòng cùng tên nhiệm vụ: AI quyết cả luồng là một việc thường kỳ hay nhiều việc nối tiếp.
CREATE TYPE "TaskStreamMode" AS ENUM ('ROUTINE', 'ITEMS');
CREATE TABLE "task_streams" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nameKey" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "mode" "TaskStreamMode" NOT NULL,
    "reasoning" TEXT,
    "decidedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_streams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_streams_departmentId_year_nameKey_key" ON "task_streams"("departmentId", "year", "nameKey");
