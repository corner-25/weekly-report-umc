CREATE TABLE "vip_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vip_guest_visits" (
    "id" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "guestName" TEXT NOT NULL,
    "organizationId" TEXT,
    "phone" TEXT,
    "contactInfo" TEXT,
    "supportContent" TEXT NOT NULL,
    "destination" TEXT,
    "staffName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_guest_visits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vip_organizations_name_key" ON "vip_organizations"("name");
CREATE UNIQUE INDEX "vip_organizations_normalizedName_key" ON "vip_organizations"("normalizedName");
CREATE INDEX "vip_guest_visits_visitDate_idx" ON "vip_guest_visits"("visitDate");
CREATE INDEX "vip_guest_visits_staffName_idx" ON "vip_guest_visits"("staffName");
CREATE INDEX "vip_guest_visits_organizationId_idx" ON "vip_guest_visits"("organizationId");

ALTER TABLE "vip_guest_visits"
ADD CONSTRAINT "vip_guest_visits_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "vip_organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
