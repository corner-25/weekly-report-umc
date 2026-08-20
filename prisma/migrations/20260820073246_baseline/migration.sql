-- CreateEnum
CREATE TYPE "Status" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('CONFIRMED', 'UNCONFIRMED');

-- CreateEnum
CREATE TYPE "HospitalEventType" AS ENUM ('ORGANIZED', 'COLLABORATED');

-- CreateEnum
CREATE TYPE "SecretaryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SCREENING', 'INTERVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScreeningResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('AMBULANCE', 'ADMIN_CAR', 'BUS', 'TRUCK', 'PICKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('IN_USE', 'RETIRED', 'SOLD', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "ScreeningRating" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'AVERAGE', 'POOR');

-- CreateEnum
CREATE TYPE "LicenseCategory" AS ENUM ('HOSPITAL', 'DEPARTMENT', 'VEHICLE', 'ADMIN_VEHICLE', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MOUStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "MOUCategory" AS ENUM ('DOMESTIC', 'INTERNATIONAL', 'ACADEMIC', 'CLINICAL', 'TECHNOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "ClauseStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProgressType" AS ENUM ('RECURRING', 'CUMULATIVE');

-- CreateEnum
CREATE TYPE "ClauseType" AS ENUM ('TRAINING', 'RESEARCH', 'CLINICAL', 'TECHNOLOGY_TRANSFER', 'EXPERT_EXCHANGE', 'FACILITY', 'EQUIPMENT', 'FINANCE', 'HR', 'EVENT', 'PUBLICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ResponsibleParty" AS ENUM ('UMC', 'PARTNER', 'BOTH');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "generatedSql" TEXT,
    "rowCount" INTEGER,
    "answer" TEXT,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeks" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reportFileUrl" TEXT,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_tasks" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "estimatedDuration" INTEGER,
    "progressType" "ProgressType" NOT NULL DEFAULT 'RECURRING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "week_task_progress" (
    "id" TEXT NOT NULL,
    "masterTaskId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "timePeriod" TEXT NOT NULL,
    "progress" INTEGER,
    "nextWeekPlan" TEXT NOT NULL,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "week_task_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "taskName" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "timePeriod" TEXT NOT NULL,
    "progress" INTEGER,
    "nextWeekPlan" TEXT NOT NULL,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_definitions" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "week_metric_values" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "week_metric_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "content" TEXT NOT NULL,
    "chair" TEXT,
    "participants" TEXT,
    "note" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "hasMicrophone" BOOLEAN NOT NULL DEFAULT false,
    "hasSpeaker" BOOLEAN NOT NULL DEFAULT false,
    "audioSystemType" TEXT,
    "hasProjector" BOOLEAN NOT NULL DEFAULT false,
    "hasScreen" BOOLEAN NOT NULL DEFAULT false,
    "hasTV" BOOLEAN NOT NULL DEFAULT false,
    "hasSmartBoard" BOOLEAN NOT NULL DEFAULT false,
    "visualEquipment" TEXT,
    "hasWifi" BOOLEAN NOT NULL DEFAULT false,
    "hasAircon" BOOLEAN NOT NULL DEFAULT false,
    "hasWhiteboard" BOOLEAN NOT NULL DEFAULT false,
    "furnitureType" TEXT,
    "otherAmenities" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "meeting_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "description" TEXT,
    "meetingRoomId" TEXT,
    "eventType" "HospitalEventType" NOT NULL DEFAULT 'ORGANIZED',
    "chair" TEXT,
    "participants" TEXT,
    "note" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hospital_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_checklist_items" (
    "id" TEXT NOT NULL,
    "hospitalEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secretary_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secretary_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secretaries" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "phone" TEXT,
    "email" TEXT,
    "avatar" TEXT,
    "secretaryTypeId" TEXT,
    "currentDepartmentId" TEXT,
    "status" "SecretaryStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "secretaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secretary_exam_scores" (
    "id" TEXT NOT NULL,
    "secretaryId" TEXT NOT NULL,
    "examName" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "part1" DOUBLE PRECISION,
    "part2" DOUBLE PRECISION,
    "part3" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "rank" INTEGER,
    "formula" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secretary_exam_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secretary_certificates" (
    "id" TEXT NOT NULL,
    "secretaryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuedYear" INTEGER,
    "issuedBy" TEXT,
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secretary_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secretary_transfer_logs" (
    "id" TEXT NOT NULL,
    "secretaryId" TEXT NOT NULL,
    "fromDepartmentId" TEXT,
    "toDepartmentId" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "decisionNumber" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "secretary_transfer_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "category" "VehicleCategory" NOT NULL DEFAULT 'OTHER',
    "color" TEXT,
    "engineNumber" TEXT,
    "chassisNumber" TEXT,
    "seatCount" TEXT,
    "payloadKg" TEXT,
    "curbWeightKg" TEXT,
    "totalWeightKg" TEXT,
    "manufactureYear" INTEGER,
    "manufactureCountry" TEXT,
    "expiryYear" TEXT,
    "registrationNumber" TEXT,
    "registrationDate" TIMESTAMP(3),
    "firstRegistrationDate" TIMESTAMP(3),
    "inspectionCertNumber" TEXT,
    "inspectionExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "ownerName" TEXT,
    "ownerAddress" TEXT,
    "manager" TEXT,
    "dimensions" TEXT,
    "tireSpecification" TEXT,
    "wheelTrack" TEXT,
    "wheelbase" TEXT,
    "fuelType" TEXT,
    "engineType" TEXT,
    "displacement" TEXT,
    "maxPower" TEXT,
    "steeringSystem" TEXT,
    "transmission" TEXT,
    "brakeSystem" TEXT,
    "parkingBrake" TEXT,
    "airConditioning" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'IN_USE',
    "rawHistory" TEXT,
    "sourceFile" TEXT,
    "licenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_maintenance_logs" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "odometer" INTEGER,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "workshop" TEXT,
    "costAmount" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secretary_applications" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "birthPlace" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "permanentAddress" TEXT,
    "temporaryAddress" TEXT,
    "cvUrl" TEXT,
    "education" TEXT,
    "educationInstitution" TEXT,
    "graduationYear" INTEGER,
    "graduationRank" TEXT,
    "trainingCertificate" TEXT,
    "foreignLanguage" TEXT,
    "itSkill" TEXT,
    "appliedPosition" TEXT,
    "workExperience" TEXT,
    "previousSalary" DECIMAL(15,2),
    "resignReason" TEXT,
    "knowsHospital" BOOLEAN,
    "hospitalRelative" TEXT,
    "appliedTypeId" TEXT,
    "desiredDepartmentId" TEXT,
    "source" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SCREENING',
    "screeningDate" TIMESTAMP(3),
    "screeningLocation" TEXT,
    "screeningPanel" TEXT,
    "ratingAppearance" "ScreeningRating",
    "ratingExpertise" "ScreeningRating",
    "ratingCommunication" "ScreeningRating",
    "ratingITSkill" "ScreeningRating",
    "ratingAI" "ScreeningRating",
    "ratingKnowledge" "ScreeningRating",
    "scoreMultipleChoice" DOUBLE PRECISION,
    "scoreWordProcessing" DOUBLE PRECISION,
    "scoreTypingSpeed" DOUBLE PRECISION,
    "typingWordsPerMinute" INTEGER,
    "screeningResult" "ScreeningResult",
    "screeningNotes" TEXT,
    "interviewDate" TIMESTAMP(3),
    "interviewScore" DOUBLE PRECISION,
    "interviewNotes" TEXT,
    "notes" TEXT,
    "convertedSecretaryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "secretary_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "category" "LicenseCategory" NOT NULL,
    "issuedBy" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "scope" TEXT,
    "fileUrl" TEXT,
    "notes" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_renewals" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "renewedDate" TIMESTAMP(3) NOT NULL,
    "newExpiryDate" TIMESTAMP(3),
    "previousExpiry" TIMESTAMP(3),
    "renewedBy" TEXT,
    "decisionNumber" TEXT,
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mous" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mouNumber" TEXT,
    "category" "MOUCategory" NOT NULL,
    "status" "MOUStatus" NOT NULL DEFAULT 'DRAFT',
    "partnerName" TEXT NOT NULL,
    "partnerCountry" TEXT,
    "partnerContact" TEXT,
    "partnerLogo" TEXT,
    "signedDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "purpose" TEXT,
    "scope" TEXT,
    "keyTerms" TEXT,
    "fileUrl" TEXT,
    "notes" TEXT,
    "departmentId" TEXT,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "mous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mou_clauses" (
    "id" TEXT NOT NULL,
    "mouId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "clauseType" "ClauseType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "responsibleParty" "ResponsibleParty" NOT NULL DEFAULT 'BOTH',
    "responsible" TEXT,
    "deadline" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "clauseStatus" "ClauseStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "result" TEXT,
    "quality" TEXT,
    "budget" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mou_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_progress" (
    "id" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "achievement" TEXT,
    "issues" TEXT,
    "nextSteps" TEXT,
    "progressBefore" INTEGER,
    "progressAfter" INTEGER,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clause_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mou_progress" (
    "id" TEXT NOT NULL,
    "mouId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "achievement" TEXT,
    "issues" TEXT,
    "nextSteps" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mou_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mou_activities" (
    "id" TEXT NOT NULL,
    "mouId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "activityType" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "participants" TEXT,
    "responsible" TEXT,
    "budget" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mou_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mou_documents" (
    "id" TEXT NOT NULL,
    "mouId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentType" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mou_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "chatbot_audit_logs_userId_createdAt_idx" ON "chatbot_audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "chatbot_audit_logs_createdAt_idx" ON "chatbot_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "weeks_createdById_idx" ON "weeks"("createdById");

-- CreateIndex
CREATE INDEX "weeks_year_weekNumber_idx" ON "weeks"("year", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "weeks_weekNumber_year_key" ON "weeks"("weekNumber", "year");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "master_tasks_departmentId_idx" ON "master_tasks"("departmentId");

-- CreateIndex
CREATE INDEX "master_tasks_createdAt_idx" ON "master_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "week_task_progress_weekId_idx" ON "week_task_progress"("weekId");

-- CreateIndex
CREATE INDEX "week_task_progress_masterTaskId_idx" ON "week_task_progress"("masterTaskId");

-- CreateIndex
CREATE INDEX "week_task_progress_weekId_masterTaskId_idx" ON "week_task_progress"("weekId", "masterTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "week_task_progress_masterTaskId_weekId_key" ON "week_task_progress"("masterTaskId", "weekId");

-- CreateIndex
CREATE INDEX "tasks_weekId_idx" ON "tasks"("weekId");

-- CreateIndex
CREATE INDEX "tasks_departmentId_idx" ON "tasks"("departmentId");

-- CreateIndex
CREATE INDEX "metric_definitions_departmentId_idx" ON "metric_definitions"("departmentId");

-- CreateIndex
CREATE INDEX "week_metric_values_weekId_idx" ON "week_metric_values"("weekId");

-- CreateIndex
CREATE INDEX "week_metric_values_metricId_idx" ON "week_metric_values"("metricId");

-- CreateIndex
CREATE INDEX "week_metric_values_weekId_metricId_idx" ON "week_metric_values"("weekId", "metricId");

-- CreateIndex
CREATE UNIQUE INDEX "week_metric_values_metricId_weekId_key" ON "week_metric_values"("metricId", "weekId");

-- CreateIndex
CREATE INDEX "events_date_idx" ON "events"("date");

-- CreateIndex
CREATE INDEX "events_date_status_idx" ON "events"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_rooms_name_key" ON "meeting_rooms"("name");

-- CreateIndex
CREATE INDEX "hospital_events_date_idx" ON "hospital_events"("date");

-- CreateIndex
CREATE INDEX "hospital_events_meetingRoomId_idx" ON "hospital_events"("meetingRoomId");

-- CreateIndex
CREATE INDEX "hospital_events_date_meetingRoomId_idx" ON "hospital_events"("date", "meetingRoomId");

-- CreateIndex
CREATE INDEX "hospital_events_deletedAt_date_idx" ON "hospital_events"("deletedAt", "date");

-- CreateIndex
CREATE INDEX "event_checklist_items_hospitalEventId_idx" ON "event_checklist_items"("hospitalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "secretary_types_name_key" ON "secretary_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "secretaries_employeeCode_key" ON "secretaries"("employeeCode");

-- CreateIndex
CREATE INDEX "secretaries_secretaryTypeId_idx" ON "secretaries"("secretaryTypeId");

-- CreateIndex
CREATE INDEX "secretaries_currentDepartmentId_idx" ON "secretaries"("currentDepartmentId");

-- CreateIndex
CREATE INDEX "secretaries_dateOfBirth_idx" ON "secretaries"("dateOfBirth");

-- CreateIndex
CREATE INDEX "secretaries_deletedAt_status_secretaryTypeId_idx" ON "secretaries"("deletedAt", "status", "secretaryTypeId");

-- CreateIndex
CREATE INDEX "secretary_exam_scores_secretaryId_idx" ON "secretary_exam_scores"("secretaryId");

-- CreateIndex
CREATE INDEX "secretary_exam_scores_examYear_idx" ON "secretary_exam_scores"("examYear");

-- CreateIndex
CREATE UNIQUE INDEX "secretary_exam_scores_secretaryId_examName_key" ON "secretary_exam_scores"("secretaryId", "examName");

-- CreateIndex
CREATE INDEX "secretary_certificates_secretaryId_idx" ON "secretary_certificates"("secretaryId");

-- CreateIndex
CREATE INDEX "secretary_transfer_logs_secretaryId_idx" ON "secretary_transfer_logs"("secretaryId");

-- CreateIndex
CREATE INDEX "secretary_transfer_logs_fromDepartmentId_idx" ON "secretary_transfer_logs"("fromDepartmentId");

-- CreateIndex
CREATE INDEX "secretary_transfer_logs_toDepartmentId_idx" ON "secretary_transfer_logs"("toDepartmentId");

-- CreateIndex
CREATE INDEX "secretary_transfer_logs_transferDate_idx" ON "secretary_transfer_logs"("transferDate");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_licensePlate_key" ON "vehicles"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_licenseId_key" ON "vehicles"("licenseId");

-- CreateIndex
CREATE INDEX "vehicles_category_idx" ON "vehicles"("category");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_brand_idx" ON "vehicles"("brand");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_logs_vehicleId_date_idx" ON "vehicle_maintenance_logs"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_logs_date_idx" ON "vehicle_maintenance_logs"("date");

-- CreateIndex
CREATE UNIQUE INDEX "secretary_applications_convertedSecretaryId_key" ON "secretary_applications"("convertedSecretaryId");

-- CreateIndex
CREATE INDEX "secretary_applications_status_idx" ON "secretary_applications"("status");

-- CreateIndex
CREATE INDEX "secretary_applications_appliedTypeId_idx" ON "secretary_applications"("appliedTypeId");

-- CreateIndex
CREATE INDEX "secretary_applications_desiredDepartmentId_idx" ON "secretary_applications"("desiredDepartmentId");

-- CreateIndex
CREATE INDEX "secretary_applications_screeningDate_idx" ON "secretary_applications"("screeningDate");

-- CreateIndex
CREATE INDEX "licenses_category_idx" ON "licenses"("category");

-- CreateIndex
CREATE INDEX "licenses_departmentId_idx" ON "licenses"("departmentId");

-- CreateIndex
CREATE INDEX "licenses_expiryDate_idx" ON "licenses"("expiryDate");

-- CreateIndex
CREATE INDEX "licenses_category_expiryDate_idx" ON "licenses"("category", "expiryDate");

-- CreateIndex
CREATE INDEX "license_renewals_licenseId_idx" ON "license_renewals"("licenseId");

-- CreateIndex
CREATE INDEX "license_renewals_renewedDate_idx" ON "license_renewals"("renewedDate");

-- CreateIndex
CREATE INDEX "mous_category_idx" ON "mous"("category");

-- CreateIndex
CREATE INDEX "mous_status_idx" ON "mous"("status");

-- CreateIndex
CREATE INDEX "mous_departmentId_idx" ON "mous"("departmentId");

-- CreateIndex
CREATE INDEX "mous_expiryDate_idx" ON "mous"("expiryDate");

-- CreateIndex
CREATE INDEX "mous_status_expiryDate_idx" ON "mous"("status", "expiryDate");

-- CreateIndex
CREATE INDEX "mou_clauses_mouId_idx" ON "mou_clauses"("mouId");

-- CreateIndex
CREATE INDEX "mou_clauses_mouId_orderNumber_idx" ON "mou_clauses"("mouId", "orderNumber");

-- CreateIndex
CREATE INDEX "mou_clauses_mouId_clauseType_idx" ON "mou_clauses"("mouId", "clauseType");

-- CreateIndex
CREATE INDEX "clause_progress_clauseId_idx" ON "clause_progress"("clauseId");

-- CreateIndex
CREATE INDEX "clause_progress_date_idx" ON "clause_progress"("date");

-- CreateIndex
CREATE INDEX "mou_progress_mouId_idx" ON "mou_progress"("mouId");

-- CreateIndex
CREATE INDEX "mou_progress_date_idx" ON "mou_progress"("date");

-- CreateIndex
CREATE INDEX "mou_activities_mouId_idx" ON "mou_activities"("mouId");

-- CreateIndex
CREATE INDEX "mou_activities_status_idx" ON "mou_activities"("status");

-- CreateIndex
CREATE INDEX "mou_activities_startDate_idx" ON "mou_activities"("startDate");

-- CreateIndex
CREATE INDEX "mou_documents_mouId_idx" ON "mou_documents"("mouId");

-- CreateIndex
CREATE INDEX "mou_documents_documentType_idx" ON "mou_documents"("documentType");

-- AddForeignKey
ALTER TABLE "chatbot_audit_logs" ADD CONSTRAINT "chatbot_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_tasks" ADD CONSTRAINT "master_tasks_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_task_progress" ADD CONSTRAINT "week_task_progress_masterTaskId_fkey" FOREIGN KEY ("masterTaskId") REFERENCES "master_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_task_progress" ADD CONSTRAINT "week_task_progress_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_metric_values" ADD CONSTRAINT "week_metric_values_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_metric_values" ADD CONSTRAINT "week_metric_values_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_events" ADD CONSTRAINT "hospital_events_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "meeting_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_checklist_items" ADD CONSTRAINT "event_checklist_items_hospitalEventId_fkey" FOREIGN KEY ("hospitalEventId") REFERENCES "hospital_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretaries" ADD CONSTRAINT "secretaries_secretaryTypeId_fkey" FOREIGN KEY ("secretaryTypeId") REFERENCES "secretary_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretaries" ADD CONSTRAINT "secretaries_currentDepartmentId_fkey" FOREIGN KEY ("currentDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretary_exam_scores" ADD CONSTRAINT "secretary_exam_scores_secretaryId_fkey" FOREIGN KEY ("secretaryId") REFERENCES "secretaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretary_certificates" ADD CONSTRAINT "secretary_certificates_secretaryId_fkey" FOREIGN KEY ("secretaryId") REFERENCES "secretaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretary_transfer_logs" ADD CONSTRAINT "secretary_transfer_logs_secretaryId_fkey" FOREIGN KEY ("secretaryId") REFERENCES "secretaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretary_transfer_logs" ADD CONSTRAINT "secretary_transfer_logs_fromDepartmentId_fkey" FOREIGN KEY ("fromDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretary_transfer_logs" ADD CONSTRAINT "secretary_transfer_logs_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenance_logs" ADD CONSTRAINT "vehicle_maintenance_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretary_applications" ADD CONSTRAINT "secretary_applications_appliedTypeId_fkey" FOREIGN KEY ("appliedTypeId") REFERENCES "secretary_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretary_applications" ADD CONSTRAINT "secretary_applications_desiredDepartmentId_fkey" FOREIGN KEY ("desiredDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secretary_applications" ADD CONSTRAINT "secretary_applications_convertedSecretaryId_fkey" FOREIGN KEY ("convertedSecretaryId") REFERENCES "secretaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mous" ADD CONSTRAINT "mous_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mou_clauses" ADD CONSTRAINT "mou_clauses_mouId_fkey" FOREIGN KEY ("mouId") REFERENCES "mous"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_progress" ADD CONSTRAINT "clause_progress_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "mou_clauses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mou_progress" ADD CONSTRAINT "mou_progress_mouId_fkey" FOREIGN KEY ("mouId") REFERENCES "mous"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mou_activities" ADD CONSTRAINT "mou_activities_mouId_fkey" FOREIGN KEY ("mouId") REFERENCES "mous"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mou_documents" ADD CONSTRAINT "mou_documents_mouId_fkey" FOREIGN KEY ("mouId") REFERENCES "mous"("id") ON DELETE CASCADE ON UPDATE CASCADE;
