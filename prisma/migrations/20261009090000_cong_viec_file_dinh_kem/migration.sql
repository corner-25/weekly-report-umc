-- File đính kèm của công việc cào từ office (đã nén PDF).
CREATE TABLE "work_attachments" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "originalSize" INTEGER,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_attachments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "work_attachments_externalCode_key" ON "work_attachments"("externalCode");
CREATE INDEX "work_attachments_workItemId_idx" ON "work_attachments"("workItemId");
ALTER TABLE "work_attachments" ADD CONSTRAINT "work_attachments_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
