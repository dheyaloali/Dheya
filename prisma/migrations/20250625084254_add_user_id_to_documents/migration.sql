-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_employeeId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SecuritySettings" ALTER COLUMN "id" SET DEFAULT 1,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "autoMarkAbsent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "checkInWindowEnd" TEXT NOT NULL DEFAULT '20:00',
ADD COLUMN     "checkInWindowStart" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN     "checkOutWindowEnd" TEXT NOT NULL DEFAULT '23:59',
ADD COLUMN     "checkOutWindowStart" TEXT NOT NULL DEFAULT '16:00',
ADD COLUMN     "gracePeriod" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "holidayWorkEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateThreshold" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "lowBatteryAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowBatteryThreshold" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "maxLoginAttempts" TEXT NOT NULL DEFAULT '5',
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "offlineAlertThreshold" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "offlineAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordPolicy" TEXT NOT NULL DEFAULT 'strong',
ADD COLUMN     "sessionTimeout" TEXT NOT NULL DEFAULT '30m',
ADD COLUMN     "stationaryAlertThreshold" INTEGER NOT NULL DEFAULT 600,
ADD COLUMN     "stationaryAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weekendWorkEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workEndTime" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN     "workStartTime" TEXT NOT NULL DEFAULT '09:00';

-- CreateTable
CREATE TABLE "Token" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_token_key" ON "Token"("token");

-- CreateIndex
CREATE INDEX "Token_userId_idx" ON "Token"("userId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
