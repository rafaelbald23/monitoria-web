-- AlterTable
ALTER TABLE "BlingOrder" ADD COLUMN "isCancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BlingOrder" ADD COLUMN "cancelledAt" TIMESTAMP(3);
