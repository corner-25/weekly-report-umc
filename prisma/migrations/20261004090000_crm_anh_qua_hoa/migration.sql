-- CRM: ảnh quà, hoa — quà đoàn khách tặng bệnh viện (gắn lượt tương tác) và hoa,
-- quà phòng tặng đối tác (gắn việc chăm sóc). Chỉ thêm bảng mới.

-- CreateEnum
CREATE TYPE "CrmPhotoKind" AS ENUM ('RECEIVED', 'GIVEN', 'OTHER');

-- CreateTable
CREATE TABLE "crm_photos" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT,
    "careTaskId" TEXT,
    "kind" "CrmPhotoKind" NOT NULL DEFAULT 'OTHER',
    "caption" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_photos_interactionId_idx" ON "crm_photos"("interactionId");

-- CreateIndex
CREATE INDEX "crm_photos_careTaskId_idx" ON "crm_photos"("careTaskId");

-- AddForeignKey
ALTER TABLE "crm_photos" ADD CONSTRAINT "crm_photos_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "crm_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_photos" ADD CONSTRAINT "crm_photos_careTaskId_fkey" FOREIGN KEY ("careTaskId") REFERENCES "crm_care_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mỗi ảnh thuộc đúng một mục; cùng ảnh không tải hai lần vào một mục.
ALTER TABLE "crm_photos" ADD CONSTRAINT "crm_photos_one_owner_check"
    CHECK (("interactionId" IS NULL) <> ("careTaskId" IS NULL));
CREATE UNIQUE INDEX "crm_photos_owner_sha256_key" ON "crm_photos"(COALESCE("interactionId", "careTaskId"), "sha256");
