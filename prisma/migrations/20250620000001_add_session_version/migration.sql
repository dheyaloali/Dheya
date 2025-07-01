-- Add sessionVersion field to User model for tracking session validity
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1; 