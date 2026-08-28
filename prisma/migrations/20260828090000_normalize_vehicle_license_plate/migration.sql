ALTER TABLE "vehicles" ADD COLUMN "licensePlateNormalized" TEXT;

UPDATE "vehicles"
SET "licensePlateNormalized" = UPPER(REGEXP_REPLACE("licensePlate", '[^A-Za-z0-9]', '', 'g'));

DO $$
DECLARE
    duplicate_plates TEXT;
BEGIN
    SELECT STRING_AGG(plate, ', ')
    INTO duplicate_plates
    FROM (
        SELECT "licensePlateNormalized" AS plate
        FROM "vehicles"
        GROUP BY "licensePlateNormalized"
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_plates IS NOT NULL THEN
        RAISE EXCEPTION 'Không thể chuẩn hoá biển số vì có hồ sơ trùng: %', duplicate_plates;
    END IF;

    IF EXISTS (SELECT 1 FROM "vehicles" WHERE "licensePlateNormalized" = '') THEN
        RAISE EXCEPTION 'Không thể chuẩn hoá: có hồ sơ xe với biển số không chứa chữ hoặc số';
    END IF;
END $$;

ALTER TABLE "vehicles" ALTER COLUMN "licensePlateNormalized" SET NOT NULL;
CREATE UNIQUE INDEX "vehicles_licensePlateNormalized_key"
ON "vehicles"("licensePlateNormalized");
