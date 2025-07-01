-- Migration: Add notification analytics and tracking fields
-- This migration adds production-ready fields to the Notification table

-- Add delivery tracking fields
ALTER TABLE "Notification" ADD COLUMN "deliveryStatus" TEXT DEFAULT 'pending';
ALTER TABLE "Notification" ADD COLUMN "deliveryAttempts" INTEGER DEFAULT 0;
ALTER TABLE "Notification" ADD COLUMN "deliveredAt" TIMESTAMP;
ALTER TABLE "Notification" ADD COLUMN "failedAt" TIMESTAMP;
ALTER TABLE "Notification" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "Notification" ADD COLUMN "lastAttemptAt" TIMESTAMP;

-- Add analytics and tracking fields
ALTER TABLE "Notification" ADD COLUMN "clickedAt" TIMESTAMP;
ALTER TABLE "Notification" ADD COLUMN "actionCompletedAt" TIMESTAMP;
ALTER TABLE "Notification" ADD COLUMN "engagementScore" REAL;
ALTER TABLE "Notification" ADD COLUMN "priority" TEXT DEFAULT 'normal';
ALTER TABLE "Notification" ADD COLUMN "category" TEXT;

-- Add scalability fields
ALTER TABLE "Notification" ADD COLUMN "batchId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "retryCount" INTEGER DEFAULT 0;
ALTER TABLE "Notification" ADD COLUMN "maxRetries" INTEGER DEFAULT 3;

-- Add indexes for performance
CREATE INDEX "Notification_deliveryStatus_idx" ON "Notification"("deliveryStatus");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
CREATE INDEX "Notification_batchId_idx" ON "Notification"("batchId");
CREATE INDEX "Notification_category_idx" ON "Notification"("category");
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- Add constraints for data integrity
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_deliveryStatus_check" 
  CHECK ("deliveryStatus" IN ('pending', 'sent', 'delivered', 'failed', 'retrying'));

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_priority_check" 
  CHECK ("priority" IN ('low', 'normal', 'high', 'urgent'));

-- Update existing notifications to have proper delivery status
UPDATE "Notification" 
SET "deliveryStatus" = 'delivered' 
WHERE "read" = true;

UPDATE "Notification" 
SET "deliveryStatus" = 'pending' 
WHERE "read" = false AND "deliveryStatus" IS NULL; 