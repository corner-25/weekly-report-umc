-- Theo dõi nhiệm vụ: nối dòng báo cáo tuần thành từng việc, AI xác định loại và
-- tình trạng. Chỉ thêm bảng mới.

CREATE TYPE "TaskThreadKind" AS ENUM ('ROUTINE', 'PROJECT', 'ONE_OFF');
CREATE TYPE "TaskThreadStatus" AS ENUM ('IN_PROGRESS', 'DONE', 'STALLED', 'STOPPED');

CREATE TABLE "department_report_profiles" (
    "departmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "stats" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "department_report_profiles_pkey" PRIMARY KEY ("departmentId")
);

CREATE TABLE "task_threads" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rawName" TEXT NOT NULL,
    "parentGroup" TEXT,
    "title" TEXT NOT NULL,
    "firstWeek" INTEGER NOT NULL,
    "lastWeek" INTEGER NOT NULL,
    "kind" "TaskThreadKind",
    "status" "TaskThreadStatus",
    "progress" INTEGER,
    "completedWeek" INTEGER,
    "evidence" TEXT,
    "reasoning" TEXT,
    "confidence" DOUBLE PRECISION,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "aiUpdatedAt" TIMESTAMP(3),
    "judgedWeek" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overrideKind" "TaskThreadKind",
    "overrideStatus" "TaskThreadStatus",
    "overrideProgress" INTEGER,
    "overrideNote" TEXT,
    "overriddenBy" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_thread_entries" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "rawName" TEXT NOT NULL,
    "parentGroup" TEXT,
    "resultText" TEXT NOT NULL,
    "progress" INTEGER,
    "timePeriod" TEXT,
    "nextWeekPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_thread_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_threads_departmentId_year_lastWeek_idx" ON "task_threads"("departmentId", "year", "lastWeek");
CREATE INDEX "task_threads_status_idx" ON "task_threads"("status");
CREATE UNIQUE INDEX "task_thread_entries_departmentId_year_week_sourceRow_key" ON "task_thread_entries"("departmentId", "year", "week", "sourceRow");
CREATE INDEX "task_thread_entries_threadId_week_idx" ON "task_thread_entries"("threadId", "week");

ALTER TABLE "department_report_profiles" ADD CONSTRAINT "department_report_profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_threads" ADD CONSTRAINT "task_threads_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_thread_entries" ADD CONSTRAINT "task_thread_entries_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "task_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
