-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DONOR', 'NURSE', 'DOCTOR', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "BloodComponent" AS ENUM ('WHOLE_BLOOD', 'Packed_RBC', 'PLASMA', 'PLATELETS');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('PENDING', 'APPROVED', 'DISPATCHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DONOR',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "bloodGroup" "BloodGroup",
    "phone" TEXT,
    "lastDonation" TIMESTAMP(3),
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "facilityId" TEXT,
    "licenseNo" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_inventory" (
    "id" TEXT NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "component" "BloodComponent" NOT NULL DEFAULT 'WHOLE_BLOOD',
    "units" INTEGER NOT NULL DEFAULT 0,
    "minThreshold" INTEGER NOT NULL DEFAULT 15,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "patientName" TEXT,
    "patientRef" TEXT,
    "bloodGroup" "BloodGroup" NOT NULL,
    "component" "BloodComponent" NOT NULL DEFAULT 'WHOLE_BLOOD',
    "unitsNeeded" INTEGER NOT NULL,
    "urgency" "Urgency" NOT NULL DEFAULT 'ROUTINE',
    "status" "RequisitionStatus" NOT NULL DEFAULT 'PENDING',
    "clinicalNote" TEXT,
    "facilityId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfusion_log" (
    "id" TEXT NOT NULL,
    "administeredBy" TEXT NOT NULL,
    "patientRef" TEXT NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "component" "BloodComponent" NOT NULL DEFAULT 'WHOLE_BLOOD',
    "unitsUsed" INTEGER NOT NULL DEFAULT 1,
    "vitalsStable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfusion_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bloodGroup" "BloodGroup",
    "targetUnits" INTEGER NOT NULL DEFAULT 10,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_invitation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "campaign_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_facilityId_idx" ON "user"("facilityId");

-- CreateIndex
CREATE INDEX "facility_type_idx" ON "facility"("type");

-- CreateIndex
CREATE INDEX "blood_inventory_bloodGroup_idx" ON "blood_inventory"("bloodGroup");

-- CreateIndex
CREATE UNIQUE INDEX "blood_inventory_bloodGroup_component_key" ON "blood_inventory"("bloodGroup", "component");

-- CreateIndex
CREATE INDEX "requisition_status_idx" ON "requisition"("status");

-- CreateIndex
CREATE INDEX "requisition_requesterId_idx" ON "requisition"("requesterId");

-- CreateIndex
CREATE INDEX "requisition_facilityId_idx" ON "requisition"("facilityId");

-- CreateIndex
CREATE INDEX "transfusion_log_administeredBy_idx" ON "transfusion_log"("administeredBy");

-- CreateIndex
CREATE INDEX "campaign_status_idx" ON "campaign"("status");

-- CreateIndex
CREATE INDEX "campaign_invitation_campaignId_idx" ON "campaign_invitation"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_invitation_donorId_idx" ON "campaign_invitation"("donorId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition" ADD CONSTRAINT "requisition_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition" ADD CONSTRAINT "requisition_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfusion_log" ADD CONSTRAINT "transfusion_log_administeredBy_fkey" FOREIGN KEY ("administeredBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_invitation" ADD CONSTRAINT "campaign_invitation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_invitation" ADD CONSTRAINT "campaign_invitation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

