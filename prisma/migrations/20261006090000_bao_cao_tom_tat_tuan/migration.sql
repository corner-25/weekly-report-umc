-- Báo cáo tóm tắt hoạt động Bệnh viện theo tuần (AI viết, Phòng HC sửa và chốt).
CREATE TABLE "weekly_summaries" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "model" TEXT,
    "tokens" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "editedBy" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "weekly_summaries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "weekly_summaries_weekId_key" ON "weekly_summaries"("weekId");
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_weekId_fkey"
  FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
