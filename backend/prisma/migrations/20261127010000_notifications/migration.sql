CREATE TABLE "Notification" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "scope" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "url" TEXT NOT NULL,
 "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE TABLE "PushToken" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "token" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");
CREATE TABLE "PushDelivery" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "notificationId" UUID NOT NULL REFERENCES "Notification"("id") ON DELETE CASCADE,
 "tokenId" UUID NOT NULL REFERENCES "PushToken"("id") ON DELETE CASCADE, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedUntil" TIMESTAMP(3), "lastError" TEXT
);
CREATE UNIQUE INDEX "PushDelivery_notificationId_tokenId_key" ON "PushDelivery"("notificationId", "tokenId");
CREATE INDEX "PushDelivery_status_nextAttemptAt_idx" ON "PushDelivery"("status", "nextAttemptAt");

-- Transactional event creation: a rollback of the business mutation also rolls
-- back notifications/outbox. No polling of historical orders or duplicate seed.
CREATE FUNCTION gce_notify(recipient UUID, audience TEXT, heading TEXT, content TEXT, target TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE nid UUID;
BEGIN
 INSERT INTO "Notification"("userId", "scope", "title", "body", "url") VALUES(recipient, audience, heading, content, target) RETURNING "id" INTO nid;
 INSERT INTO "PushDelivery"("notificationId", "tokenId") SELECT nid, "id" FROM "PushToken" WHERE "userId" = recipient;
END $$;

CREATE FUNCTION gce_order_notification() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE recipient UUID; fresh BOOLEAN; heading TEXT;
BEGIN
 IF NEW."submittedAt" IS NULL THEN RETURN NEW; END IF;
 IF TG_OP = 'INSERT' THEN fresh := TRUE;
 ELSE fresh := OLD."submittedAt" IS NULL;
   IF NOT fresh AND NEW."status" IS NOT DISTINCT FROM OLD."status" AND NEW."paymentStatus" IS NOT DISTINCT FROM OLD."paymentStatus" THEN RETURN NEW; END IF;
 END IF;
 heading := CASE WHEN fresh THEN 'Tiệm có đơn hàng mới' ELSE 'Đơn hàng vừa cập nhật' END;
 FOR recipient IN SELECT "id" FROM "User" WHERE "role" IN ('ADMIN','CASHIER','WAREHOUSE') LOOP
   PERFORM gce_notify(recipient, 'ORDERS', heading, 'Đơn ' || NEW."code" || ' có thông tin mới. Mở để kiểm tra.', '/quan-tri?tab=orders');
 END LOOP;
 IF NEW."customerId" IS NOT NULL THEN
   PERFORM gce_notify(NEW."customerId", 'CUSTOMER', CASE WHEN fresh THEN 'Tiệm đã nhận đơn của bạn' WHEN NEW."paymentStatus" = 'PAID' THEN 'Cập nhật đơn đã thanh toán' ELSE 'Kiện gốm của bạn có cập nhật' END, 'Đơn ' || NEW."code" || ' vừa được cập nhật. Mở để xem chi tiết.', '/don-hang/' || NEW."id");
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gce_order_notice AFTER INSERT OR UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION gce_order_notification();

CREATE FUNCTION gce_inquiry_notification() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE recipient UUID;
BEGIN
 FOR recipient IN SELECT "id" FROM "User" WHERE "role" IN ('ADMIN','CASHIER') LOOP
   PERFORM gce_notify(recipient, 'INQUIRIES', 'Hộp thư tiệm có lời nhắn mới', 'Có lời nhắn đang chờ tiệm phản hồi.', '/quan-tri?tab=inquiries');
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER gce_inquiry_notice AFTER INSERT ON "Inquiry" FOR EACH ROW EXECUTE FUNCTION gce_inquiry_notification();

CREATE FUNCTION gce_return_notification() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE recipient UUID; customer UUID;
BEGIN
 IF TG_OP = 'UPDATE' THEN
   IF NEW."status" IS NOT DISTINCT FROM OLD."status" AND NEW."refund" IS NOT DISTINCT FROM OLD."refund" THEN RETURN NEW; END IF;
 END IF;
 FOR recipient IN SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LOOP
   PERFORM gce_notify(recipient, 'RETURNS', 'Đổi trả & hoàn tiền có cập nhật', 'Có yêu cầu đổi trả cần tiệm kiểm tra.', '/quan-tri?tab=returns');
 END LOOP;
 SELECT "customerId" INTO customer FROM "Order" WHERE "id" = NEW."orderId";
 IF customer IS NOT NULL THEN
   PERFORM gce_notify(customer, 'CUSTOMER', 'Yêu cầu đổi trả của bạn có cập nhật', 'Mở đơn hàng để xem thông tin xử lý đổi trả và hoàn tiền.', '/don-hang/' || NEW."orderId");
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gce_return_notice AFTER INSERT OR UPDATE ON "ReturnRequest" FOR EACH ROW EXECUTE FUNCTION gce_return_notification();
