CREATE TABLE "ShopSettings" (
  "id" TEXT NOT NULL DEFAULT 'shop',
  "address" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "openingHours" TEXT NOT NULL DEFAULT '',
  "bankName" TEXT NOT NULL DEFAULT '',
  "bankAccount" TEXT NOT NULL DEFAULT '',
  "bankOwner" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);
