-- Kho tri thức cho chatbot: đoạn văn tự do của mọi phân hệ, tìm theo từ khoá (không dấu)
-- và theo nghĩa (vector embedding). pgvector có sẵn trên Postgres Railway.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "department" TEXT,
    "organization" TEXT,
    "occurred_on" DATE,
    "year" INTEGER,
    "week" INTEGER,
    "href" TEXT,
    "search_key" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "embedding" vector,
    "embedding_model" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks"("source");
CREATE INDEX "knowledge_chunks_occurred_on_idx" ON "knowledge_chunks"("occurred_on");

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_readonly') THEN
    GRANT SELECT ON "knowledge_chunks" TO chatbot_readonly;
  END IF;
END $$;
