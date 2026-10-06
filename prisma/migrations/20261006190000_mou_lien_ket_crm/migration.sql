-- MOU gắn với tổ chức đối tác trong CRM (cùng một đơn vị), AI ghép theo tên.
ALTER TABLE "mous" ADD COLUMN "crmOrganizationId" TEXT, ADD COLUMN "crmMatch" JSONB;
CREATE INDEX "mous_crmOrganizationId_idx" ON "mous"("crmOrganizationId");
ALTER TABLE "mous" ADD CONSTRAINT "mous_crmOrganizationId_fkey" FOREIGN KEY ("crmOrganizationId") REFERENCES "crm_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
