-- MOU cào từ office.umc.edu.vn: mã nguồn để cào lại không trùng, file đính kèm lưu trong DB.
ALTER TABLE "mous" ADD COLUMN "externalCode" TEXT,
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "externalStatus" TEXT,
  ADD COLUMN "cooperationField" TEXT,
  ADD COLUMN "progressPercent" INTEGER,
  ADD COLUMN "watchers" TEXT;
CREATE UNIQUE INDEX "mous_externalCode_key" ON "mous"("externalCode");

ALTER TABLE "mou_progress" ADD COLUMN "externalKey" TEXT;
CREATE UNIQUE INDEX "mou_progress_externalKey_key" ON "mou_progress"("externalKey");

ALTER TABLE "mou_documents" ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "originalSize" INTEGER,
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "data" BYTEA,
  ADD COLUMN "externalCode" TEXT;
CREATE UNIQUE INDEX "mou_documents_externalCode_key" ON "mou_documents"("externalCode");
