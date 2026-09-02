CREATE TABLE "birthday_email_logs" (
    "id" TEXT NOT NULL,
    "secretaryId" TEXT NOT NULL,
    "birthdayYear" INTEGER NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "birthday_email_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "birthday_email_logs_secretaryId_birthdayYear_key"
ON "birthday_email_logs"("secretaryId", "birthdayYear");

CREATE INDEX "birthday_email_logs_birthdayYear_status_idx"
ON "birthday_email_logs"("birthdayYear", "status");

ALTER TABLE "birthday_email_logs"
ADD CONSTRAINT "birthday_email_logs_secretaryId_fkey"
FOREIGN KEY ("secretaryId") REFERENCES "secretaries"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
