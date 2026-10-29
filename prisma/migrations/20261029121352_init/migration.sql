-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "dayStart" TEXT NOT NULL,
    "dayEnd" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL,
    "tables" INTEGER NOT NULL,
    "sectors" TEXT[],
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "ApprovalStatus" NOT NULL,
    "company" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "place" TEXT NOT NULL,
    "sectors" TEXT[],
    "products" TEXT NOT NULL,
    "about" TEXT NOT NULL DEFAULT '',
    "extra" TEXT NOT NULL DEFAULT '',
    "udyam" TEXT,
    "iec" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "slotDate" TEXT,
    "slotTime" TEXT,
    "table" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LoginCode_email_createdAt_idx" ON "LoginCode"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Participant_eventId_role_status_idx" ON "Participant"("eventId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_eventId_userId_key" ON "Participant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "MeetingRequest_eventId_status_idx" ON "MeetingRequest"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRequest_fromId_toId_key" ON "MeetingRequest"("fromId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRequest_eventId_slotDate_slotTime_table_key" ON "MeetingRequest"("eventId", "slotDate", "slotTime", "table");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
