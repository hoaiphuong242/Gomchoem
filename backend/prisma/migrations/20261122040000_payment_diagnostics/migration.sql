ALTER TABLE "PaymentAttempt"
ADD COLUMN "lastError" TEXT,
ADD COLUMN "lastCheckedAt" TIMESTAMP(3);
