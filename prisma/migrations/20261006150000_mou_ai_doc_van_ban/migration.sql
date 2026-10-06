-- AI đọc biên bản MOU: chữ OCR của văn bản, kết quả trích xuất, đánh giá triển khai, đánh giá của lãnh đạo.
ALTER TABLE "mous" ADD COLUMN "extraction" JSONB,
  ADD COLUMN "extractedAt" TIMESTAMP(3),
  ADD COLUMN "assessment" JSONB,
  ADD COLUMN "assessedAt" TIMESTAMP(3),
  ADD COLUMN "evaluation" TEXT,
  ADD COLUMN "evaluationNote" TEXT,
  ADD COLUMN "evaluatedAt" TIMESTAMP(3),
  ADD COLUMN "evaluatedBy" TEXT;

ALTER TABLE "mou_clauses" ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "evidence" JSONB;

ALTER TABLE "mou_documents" ADD COLUMN "ocrText" TEXT,
  ADD COLUMN "pageCount" INTEGER,
  ADD COLUMN "ocrAt" TIMESTAMP(3);
