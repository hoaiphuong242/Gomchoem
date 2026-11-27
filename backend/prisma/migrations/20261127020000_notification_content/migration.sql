CREATE OR REPLACE FUNCTION gce_order_notification() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE recipient UUID; fresh BOOLEAN; heading TEXT; staff_heading TEXT; content TEXT;
BEGIN
 IF NEW."submittedAt" IS NULL THEN RETURN NEW; END IF;
 IF TG_OP = 'INSERT' THEN fresh := TRUE;
 ELSE fresh := OLD."submittedAt" IS NULL;
   IF NOT fresh AND NEW."status" IS NOT DISTINCT FROM OLD."status" AND NEW."paymentStatus" IS NOT DISTINCT FROM OLD."paymentStatus" THEN RETURN NEW; END IF;
 END IF;
 IF fresh THEN
   heading := 'Gốm Cho Em đã tiếp nhận đơn hàng';
   staff_heading := 'Tiệm có đơn hàng mới';
   content := 'Đơn ' || NEW."code" || ' đã được tiếp nhận. Bạn có thể theo dõi tiến trình tại chi tiết đơn hàng.';
 ELSIF NEW."status" IS DISTINCT FROM OLD."status" THEN
   heading := CASE NEW."status"
     WHEN 'CONFIRMED' THEN 'Gốm Cho Em đã xác nhận đơn hàng'
     WHEN 'PACKING' THEN 'Gốm Cho Em đã đóng gói đơn hàng'
     WHEN 'SHIPPED' THEN 'Gốm Cho Em đã bàn giao đơn cho vận chuyển'
     WHEN 'DELIVERED' THEN 'Đơn hàng Gốm Cho Em đã giao thành công'
     WHEN 'CANCELLED' THEN 'Đơn hàng Gốm Cho Em đã được hủy'
     WHEN 'EXPIRED' THEN 'Đã hết thời gian thanh toán đơn hàng'
     WHEN 'PENDING_PAYMENT' THEN 'Đơn hàng đang chờ xác nhận thanh toán'
     ELSE 'Đơn hàng Gốm Cho Em có cập nhật' END;
   content := 'Đơn ' || NEW."code" || ': ' || CASE NEW."status"
     WHEN 'CONFIRMED' THEN 'Tiệm đã xác nhận và sẽ chuẩn bị món gốm cho bạn.'
     WHEN 'PACKING' THEN 'Tiệm đã đóng gói, chuẩn bị bàn giao cho đơn vị vận chuyển.'
     WHEN 'SHIPPED' THEN 'Đơn hàng đã được bàn giao cho đơn vị vận chuyển.'
     WHEN 'DELIVERED' THEN 'Đã ghi nhận giao hàng thành công. Cảm ơn bạn đã chọn tiệm.'
     WHEN 'CANCELLED' THEN 'Đơn hàng đã được hủy. Mở chi tiết để xem thông tin xử lý.'
     WHEN 'EXPIRED' THEN 'Thời gian thanh toán đã hết. Mở chi tiết để kiểm tra trạng thái.'
     WHEN 'PENDING_PAYMENT' THEN 'Tiệm đang chờ xác nhận thanh toán của đơn hàng.'
     ELSE 'Mở chi tiết để xem thông tin mới nhất.' END;
 ELSIF NEW."paymentStatus" IS DISTINCT FROM OLD."paymentStatus" THEN
   heading := CASE NEW."paymentStatus"
     WHEN 'PAID' THEN 'Gốm Cho Em đã xác nhận thanh toán'
     WHEN 'AWAITING_REVIEW' THEN 'Gốm Cho Em đang kiểm tra chuyển khoản'
     WHEN 'REFUNDED' THEN 'Gốm Cho Em đã ghi nhận hoàn tiền'
     ELSE 'Thanh toán đơn hàng có cập nhật' END;
   content := 'Đơn ' || NEW."code" || ': ' || CASE NEW."paymentStatus"
     WHEN 'PAID' THEN 'Tiệm đã ghi nhận thanh toán thành công.'
     WHEN 'AWAITING_REVIEW' THEN 'Tiệm đã nhận yêu cầu xác nhận chuyển khoản và đang kiểm tra.'
     WHEN 'REFUNDED' THEN 'Tiệm đã ghi nhận khoản hoàn tiền. Mở chi tiết để kiểm tra.'
     ELSE 'Mở chi tiết để xem trạng thái thanh toán.' END;
 END IF;
 FOR recipient IN SELECT "id" FROM "User" WHERE "role" IN ('ADMIN','CASHIER','WAREHOUSE') LOOP
   PERFORM gce_notify(recipient, 'ORDERS', COALESCE(staff_heading, heading), content, '/quan-tri?tab=orders');
 END LOOP;
 IF NEW."customerId" IS NOT NULL THEN
   PERFORM gce_notify(NEW."customerId", 'CUSTOMER', heading, content, '/don-hang/' || NEW."id");
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION gce_return_notification() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE recipient UUID; customer UUID; heading TEXT; content TEXT;
BEGIN
 IF TG_OP = 'UPDATE' THEN
   IF NEW."status" IS NOT DISTINCT FROM OLD."status" AND NEW."refund" IS NOT DISTINCT FROM OLD."refund" THEN RETURN NEW; END IF;
 END IF;
 heading := CASE NEW."status"
   WHEN 'REQUESTED' THEN 'Gốm Cho Em đã tiếp nhận yêu cầu đổi trả'
   WHEN 'APPROVED' THEN 'Gốm Cho Em đã duyệt yêu cầu đổi trả'
   WHEN 'REJECTED' THEN 'Gốm Cho Em đã từ chối yêu cầu đổi trả'
   WHEN 'RECEIVED' THEN 'Gốm Cho Em đã nhận lại hàng đổi trả'
   ELSE 'Yêu cầu đổi trả của bạn có cập nhật' END;
 content := CASE NEW."status"
   WHEN 'REQUESTED' THEN 'Tiệm sẽ kiểm tra yêu cầu đổi trả của đơn hàng.'
   WHEN 'APPROVED' THEN 'Yêu cầu đã được duyệt. Mở đơn hàng để xem thông tin xử lý.'
   WHEN 'REJECTED' THEN 'Mở đơn hàng để xem ghi chú xử lý của tiệm.'
   WHEN 'RECEIVED' THEN 'Tiệm đã nhận lại hàng. Mở đơn hàng để xem thông tin hoàn tiền và xử lý.'
   ELSE 'Mở đơn hàng để xem thông tin xử lý đổi trả.' END;
 FOR recipient IN SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LOOP
   PERFORM gce_notify(recipient, 'RETURNS', CASE WHEN NEW."status" = 'REQUESTED' THEN 'Tiệm có yêu cầu đổi trả mới' ELSE heading END, content, '/quan-tri?tab=returns');
 END LOOP;
 SELECT "customerId" INTO customer FROM "Order" WHERE "id" = NEW."orderId";
 IF customer IS NOT NULL THEN
   PERFORM gce_notify(customer, 'CUSTOMER', heading, content, '/don-hang/' || NEW."orderId");
 END IF;
 RETURN NEW;
END $$;
