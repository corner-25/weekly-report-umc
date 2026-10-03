-- CRM giai đoạn 2: chăm sóc đối tác — việc chuẩn bị quà, hoa cho từng lần diễn
-- ra của một dịp (sinh nhật, ngày nhận chức, kỷ niệm thành lập…), kèm dự kiến
-- và thực chi. Trao xong thì ghi thành lượt tương tác GIFT (interactionId).
-- Chỉ thêm bảng mới, không đụng dữ liệu cũ.

-- CreateEnum
CREATE TYPE "CrmGiftType" AS ENUM ('FLOWERS', 'GIFT', 'CARD', 'VISIT', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmCareStatus" AS ENUM ('TODO', 'ORDERED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "crm_care_tasks" (
    "id" TEXT NOT NULL,
    "contactId" TEXT,
    "organizationId" TEXT,
    "importantDateId" TEXT,
    "occasionKind" "CrmDateKind" NOT NULL,
    "occasionDate" DATE NOT NULL,
    "occasionKey" TEXT NOT NULL,
    "giftType" "CrmGiftType" NOT NULL,
    "description" TEXT NOT NULL,
    "budget" INTEGER,
    "actualCost" INTEGER,
    "assigneeName" TEXT,
    "status" "CrmCareStatus" NOT NULL DEFAULT 'TODO',
    "deliveredAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "interactionId" TEXT,

    CONSTRAINT "crm_care_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_care_tasks_occasionKey_key" ON "crm_care_tasks"("occasionKey");

-- CreateIndex
CREATE UNIQUE INDEX "crm_care_tasks_interactionId_key" ON "crm_care_tasks"("interactionId");

-- CreateIndex
CREATE INDEX "crm_care_tasks_status_occasionDate_idx" ON "crm_care_tasks"("status", "occasionDate");

-- CreateIndex
CREATE INDEX "crm_care_tasks_contactId_idx" ON "crm_care_tasks"("contactId");

-- CreateIndex
CREATE INDEX "crm_care_tasks_organizationId_idx" ON "crm_care_tasks"("organizationId");

-- AddForeignKey
ALTER TABLE "crm_care_tasks" ADD CONSTRAINT "crm_care_tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_care_tasks" ADD CONSTRAINT "crm_care_tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "crm_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_care_tasks" ADD CONSTRAINT "crm_care_tasks_importantDateId_fkey" FOREIGN KEY ("importantDateId") REFERENCES "crm_important_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_care_tasks" ADD CONSTRAINT "crm_care_tasks_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "crm_interactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mỗi việc thuộc đúng một cá nhân hoặc một tổ chức (Prisma không khai báo được CHECK).
ALTER TABLE "crm_care_tasks" ADD CONSTRAINT "crm_care_tasks_one_target_check"
    CHECK (("contactId" IS NULL) <> ("organizationId" IS NULL));
