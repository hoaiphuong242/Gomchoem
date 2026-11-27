# VNPay, SendGrid, Cloudinary và PostgreSQL

## Chạy backend và tự tạo bảng

```powershell
npm run docker:up
npm run dev
```

`predev`/`prestart` chạy `scripts/bootstrap.ts`: áp dụng migration bằng `prisma migrate deploy`, generate client, seed bằng upsert không ghi đè. Lỗi database thì dừng trước khi mở API. Dev tạo ADMIN local nếu chưa có; production và test không tạo tài khoản tự động. Đặt `DB_SEED_ON_START=false` khi không cần catalog minh họa. `npm run db:init` chạy riêng bước khởi tạo. `npm run dev -- --port 3001` đổi cổng API nếu cần, đồng thời phải chỉnh Vite proxy và APP_BACKEND_URL cho khớp.

PostgreSQL local theo cấu hình dự án: host localhost, port 15432, database backend, schema public. Lấy username/password từ `.env`; refresh Tables trong công cụ quản lý. Có User, Product, Category, Inventory, Order, OrderItem, PaymentAttempt, EmailDelivery... Dữ liệu chính lưu trong PostgreSQL; Redis chỉ rate limit. Không dùng `db push --force-reset` hoặc `docker compose down -v` để khởi tạo.

API và worker chạy cùng `npm run dev`/`npm start`. Worker chạy mỗi 10 giây, xử lý hàng hết hạn, QueryDR và hàng đợi email. Khi triển khai bằng serverless hoặc chạy thẳng `next start`, phải vận hành worker riêng; tránh chạy thêm worker không cần thiết tại local. Migration được PostgreSQL/Prisma khóa để bảo vệ chạy đồng thời.

## VNPay

- `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`: thông tin merchant đúng môi trường.
- `VNPAY_PAYMENT_URL`: mặc định sandbox `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`.
- `VNPAY_API_URL`: mặc định QueryDR sandbox `https://sandbox.vnpayment.vn/merchant_webapi/api/transaction`.
- `VNPAY_RETURN_URL`: đã điền `http://localhost:5173/thanh-toan/vnpay/ket-qua`, có trang frontend tương ứng.
- `VNPAY_IPN_URL`: điền **HTTPS_BACKEND_PUBLIC/api/shop/payments/vnpay/ipn** rồi đăng ký đúng URL đó trên portal/qua VNPay. Biến này mô tả URL cần đăng ký; VNPay không tự biết IPN chỉ vì thêm nó vào `.env`. Localhost không nhận được callback server từ VNPay. Khi local có thể dùng public HTTPS tunnel tới cổng backend, rồi đăng ký IPN; hoặc dùng worker QueryDR để đối soát dự phòng.
- `APP_FRONTEND_URL`: dùng cùng origin với trang người dùng đã đăng nhập, mặc định localhost:5173. Truy cập website qua localhost:5173 khi test callback để giữ sessionStorage đăng nhập; 127.0.0.1 là origin khác.
- `TRUST_PROXY=true` chỉ khi backend nằm sau reverse proxy tin cậy đã ghi đè X-Forwarded-For; mặc định backend không tin header do khách gửi.

Checkout giữ 3 phút để nhập thông tin. Chọn VNPay và chốt trong hạn sẽ mở phiên thanh toán 15 phút, giữ nguyên hàng. Số tiền lấy từ PostgreSQL, nhân 100 theo đặc tả VNPay. Mỗi đơn có một reference duy nhất; nhấn lại dùng cùng phiên, không tạo giao dịch trả tiền thứ hai. Nút tiếp tục thanh toán nằm ở trang chi tiết đơn nếu khách đóng cổng trước khi xong.

IPN xác minh HMAC-SHA512, merchant, reference, số tiền và transaction number, dùng transaction Serializable. Chỉ ResponseCode=00 và TransactionStatus=00 mới xác nhận thanh toán. Backend cũng xác minh toàn bộ chữ ký Return URL và quyền sở hữu đơn; kết quả thành công hợp lệ đi qua cùng transaction xác nhận như IPN, nên khách được chuyển ngay đến `/thanh-toan/thanh-cong/:id` ngay cả khi IPN local chưa nhận được. Không tin mã thành công do frontend tự gửi nếu thiếu HMAC hợp lệ. IPN/Return lặp không cộng/trừ hàng hoặc tạo email lần nữa. QueryDR kiểm tra cả hai trường PromotionCode/PromotionAmount theo đặc tả hiện tại và vẫn hỗ trợ chữ ký terminal cũ khi không có trường khuyến mãi. QueryDR được giới hạn mỗi 5 phút/giao dịch; trình duyệt tự kiểm tra lại kết quả đang chờ mỗi 5 giây nhưng không ép gọi cổng dồn.

Giao dịch thất bại đã xác minh nhả hàng và trả lượt voucher. Phiên bỏ dở chỉ nhả khi QueryDR ký hợp lệ báo không tìm thấy sau khi hết 15 phút + 5 phút chờ thông báo. Nếu mạng/VNPay lỗi, chưa có kết luận, đảo giao dịch hoặc nghi ngờ gian lận, hệ thống tiếp tục giữ hàng để tránh bán trùng. Tiền về sau khi đơn đã nhả hàng được đánh dấu REVIEW, không tự lấy lại món đã bán; chủ tiệm kiểm tra/hoàn tiền bên ngoài và ghi nhận khi xử lý. Chưa tích hợp API hoàn tiền VNPay tự động.

Không dùng key live với endpoint sandbox. Khi triển khai đổi Return URL sang frontend thật, đăng ký IPN backend thật, cập nhật CORS và hai APP URLs.

## SendGrid gửi biên nhận đến email đăng ký của khách

- `SENDGRID_API_KEY`: quyền Mail Send.
- `SENDGRID_FROM_EMAIL`: địa chỉ sender/domain đã xác minh trong SendGrid.
- `SENDGRID_FROM_NAME`, `SENDGRID_REPLY_TO_EMAIL`: tên gửi và địa chỉ hỗ trợ.
- `SENDGRID_ORDER_TEMPLATE_ID`: Dynamic Template ID `d-...`, phiên bản đã Activate. Dán nội dung `templates/email/order-confirmation.html` vào phiên bản đó. Nếu để trống, backend render chính HTML này bằng Handlebars.
- `SENDGRID_LOGO_URL`: HTTPS public URL; nếu trống backend đính kèm logo qua CID từ `templates/email/assets/gomchoem-logo.jpg`.
- `APP_FRONTEND_URL`: origin website dùng tạo liên kết đơn hàng trong email.

Chốt COD gửi xác nhận chưa thanh toán; chuyển khoản gửi chờ kiểm tra, sau khi nhân viên xác nhận sẽ gửi cập nhật đã trả tiền. VNPay gửi sau khi có kết quả thành công đã xác minh. Email gửi đến email của tài khoản đặt đơn, không tự thay bằng số điện thoại/người nhận hàng. POS chưa gắn customer/email nên không gửi; vẫn tải/in PDF.

EmailDelivery được tạo trong cùng transaction với đơn/thanh toán. Worker gửi biên nhận PDF tiếng Việt dạng attachment qua Mail Send. HTTP 202 nghĩa là SendGrid **chấp nhận gửi**, chưa khẳng định Gmail đã nhận. Hàng đợi tự thử lại tối đa 8 lần với backoff; chủ/thu ngân thấy trạng thái trong chi tiết đơn quản trị và có nút thử lại khi FAILED. Lỗi gửi không hủy đơn. Một sự cố dừng process ngay sau SendGrid chấp nhận nhưng trước khi ghi SENT có thể gây email trùng khi retry, vì Mail Send không có khóa idempotency.

Không gửi newsletter/quên mật khẩu trong thay đổi này. PDF là biên nhận bán hàng, chưa phải hóa đơn điện tử thuế. Cần kiểm tra hộp Spam và cấu hình xác thực domain để cải thiện khả năng đến Gmail.

Lỗi SendGrid 400/401/403/404 được dừng để sửa cấu hình thay vì tự gửi lặp 8 lần; lỗi mạng, 408/429/5xx vẫn retry. `lastError` hiển thị nguyên nhân đã phân loại, không ghi body chứa địa chỉ email hoặc API key. Khi sửa xong cấu hình, khởi động lại backend/worker để đọc `.env` mới, rồi thử gửi lại từ quản trị. Chế độ SendGrid sandbox chỉ kiểm tra cấu trúc request, không chứng minh sender được phép gửi thư thật.

Nếu QueryDR trả body chỉ có `vnp_ResponseCode=99` và `Unexpected error`, đó là lỗi API truy vấn chưa trả kết quả có chữ ký. Không được xem nó là bằng chứng khách thanh toán thất bại. PaymentAttempt lưu `lastError` và `lastCheckedAt` để chủ tiệm kiểm tra trong quản trị. Callback Return/IPN hợp lệ vẫn xác nhận thành công hoặc kết thúc giao dịch thất bại mà không chờ QueryDR. Hai giao dịch cũ còn PENDING cần Return URL có chữ ký hoặc kết quả xác minh từ VNPay; không sửa trực tiếp thành PAID để bỏ cảnh báo.

## Cloudinary ảnh/video

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` chỉ để backend. `CLOUDINARY_UPLOAD_FOLDER=gomchoem` là thư mục gốc. Không cần unsigned upload preset: server ký upload_stream bằng API secret.

`POST /api/shop/uploads` yêu cầu đăng nhập, rate limit, kiểm tra MIME và magic bytes; ảnh JPG/PNG/WebP tối đa 15MB, video MP4/WebM tối đa 50MB. SDK tải trực tiếp buffer lên Cloudinary, resource_type image/video tương ứng, trả secure_url. URL được lưu vào PostgreSQL khi lưu sản phẩm, liên hệ hoặc yêu cầu trả hàng. Upload thành công nhưng người dùng bỏ form có thể để lại file chưa được gắn vào bản ghi; chưa tự xóa file Cloudinary khi xóa/sửa URL sản phẩm.

Ảnh sản phẩm và ảnh liên hệ đã dùng endpoint này, video mở kiện ở trang đổi trả cũng vậy. Chưa thêm video vào gallery sản phẩm. File local cũ vẫn đọc được qua API media. Production không tự fallback lưu file local khi thiếu cấu hình Cloudinary.

## Kiểm tra

`npm test`, `npm run test:integration`, `npm run lint`, `npm run typecheck`, build backend/frontend. Integration tạo database PostgreSQL tạm, chạy đúng bootstrap hai lần, kiểm tra không nhân bản catalog/không reset tồn kho, tranh chấp hàng cuối, IPN lặp/giả/sai tiền, QueryDR có chữ ký, callback trình duyệt, nhả hàng, tiền về muộn, email retry/PDF và upload image/video. Các lệnh test mock VNPay/SendGrid/Cloudinary, không thanh toán hoặc gửi email thật.

Nguồn đặc tả: [VNPay PAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), [VNPay QueryDR](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html), [SendGrid Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send), [Cloudinary Node upload](https://cloudinary.com/documentation/node_image_and_video_upload).
