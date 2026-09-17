ALTER TABLE "orders" ADD COLUMN "confirmationStatus" TEXT NOT NULL DEFAULT 'confirmed', ADD COLUMN "unconfirmedReason" TEXT;
ALTER TYPE "OrderType" ADD VALUE IF NOT EXISTS 'UNKNOWN';
