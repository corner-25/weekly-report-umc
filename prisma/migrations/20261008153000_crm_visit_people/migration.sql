-- AlterTable
ALTER TABLE "crm_contacts" ADD COLUMN     "referrerContactId" TEXT,
ADD COLUMN     "relatedVipContactId" TEXT,
ADD COLUMN     "vipRelationship" TEXT;

-- AlterTable
ALTER TABLE "crm_interactions" ADD COLUMN     "referrerContactId" TEXT,
ADD COLUMN     "relatedVipContactId" TEXT,
ADD COLUMN     "vipRelationship" TEXT;

-- CreateTable
CREATE TABLE "crm_visit_doctors" (
    "interactionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "crm_visit_doctors_pkey" PRIMARY KEY ("interactionId","contactId")
);

-- CreateIndex
CREATE INDEX "crm_visit_doctors_contactId_idx" ON "crm_visit_doctors"("contactId");

-- CreateIndex
CREATE INDEX "crm_contacts_referrerContactId_idx" ON "crm_contacts"("referrerContactId");

-- CreateIndex
CREATE INDEX "crm_contacts_relatedVipContactId_idx" ON "crm_contacts"("relatedVipContactId");

-- CreateIndex
CREATE INDEX "crm_interactions_referrerContactId_idx" ON "crm_interactions"("referrerContactId");

-- CreateIndex
CREATE INDEX "crm_interactions_relatedVipContactId_idx" ON "crm_interactions"("relatedVipContactId");

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_referrerContactId_fkey" FOREIGN KEY ("referrerContactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_relatedVipContactId_fkey" FOREIGN KEY ("relatedVipContactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_referrerContactId_fkey" FOREIGN KEY ("referrerContactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_relatedVipContactId_fkey" FOREIGN KEY ("relatedVipContactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_visit_doctors" ADD CONSTRAINT "crm_visit_doctors_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "crm_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_visit_doctors" ADD CONSTRAINT "crm_visit_doctors_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

