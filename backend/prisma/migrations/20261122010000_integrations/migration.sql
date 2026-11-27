ALTER TYPE "PaymentMethod" ADD VALUE 'VNPAY';

CREATE TABLE "PaymentAttempt" (
  "id" UUID NOT NULL, "orderId" UUID NOT NULL, "reference" TEXT NOT NULL,
  "amount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "transactionNo" TEXT, "responseCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "nextCheckAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentAttempt_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "PaymentAttempt_orderId_key" ON "PaymentAttempt"("orderId");
CREATE UNIQUE INDEX "PaymentAttempt_reference_key" ON "PaymentAttempt"("reference");
CREATE UNIQUE INDEX "PaymentAttempt_transactionNo_key" ON "PaymentAttempt"("transactionNo");
CREATE INDEX "PaymentAttempt_status_nextCheckAt_idx" ON "PaymentAttempt"("status", "nextCheckAt");

CREATE TABLE "EmailDelivery" (
  "id" UUID NOT NULL, "orderId" UUID NOT NULL, "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3), "sentAt" TIMESTAMP(3), "messageId" TEXT, "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailDelivery_orderId_kind_key" ON "EmailDelivery"("orderId", "kind");
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");
