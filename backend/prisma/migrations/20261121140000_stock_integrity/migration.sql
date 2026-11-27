ALTER TABLE "Order" ADD COLUMN "requestKey" UUID;
ALTER TABLE "Order" ADD COLUMN "refundAmount" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Order_requestKey_key" ON "Order"("requestKey");
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_nonnegative" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand");
ALTER TABLE "Product" ADD CONSTRAINT "Product_nonnegative_price" CHECK ("price" >= 0 AND "costPrice" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_valid_quantity" CHECK ("quantity" > 0 AND "unitPrice" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_nonnegative_amounts" CHECK ("subtotal" >= 0 AND "shippingFee" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "refundAmount" >= 0 AND "refundAmount" <= "total");
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_valid_usage" CHECK ("used" >= 0 AND "maxUses" >= 1 AND "amount" >= 0 AND "minTotal" >= 0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_valid_rating" CHECK ("rating" >= 1 AND "rating" <= 5);
