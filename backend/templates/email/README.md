# Email xác nhận đơn hàng · Gốm Cho Em

Đây là mẫu HTML cho **SendGrid Dynamic Transactional Template**, chưa nối backend gửi email.

## Các file

- `order-confirmation.html`: copy toàn bộ mã vào Code Editor của template SendGrid.
- `order-confirmation.sample.json`: dữ liệu mẫu để dán vào phần Test Data.
- `assets/gomchoem-logo.jpg`: logo gốc bạn cung cấp, dùng để tải lên kho ảnh.
- `order-confirmation.preview.html`: bản HTML đã điền dữ liệu minh họa và logo local để xem thiết kế.
- `order-confirmation.transfer.preview.html`: trạng thái chuyển khoản chờ đối soát.
- `order-confirmation.paid.preview.html`: trạng thái đã xác nhận thanh toán.

## Dùng trong SendGrid

1. Tạo/chọn **Dynamic Template**, thêm version HTML và dán mã `order-confirmation.html`.
2. Subject gợi ý: `Gốm Cho Em đã nhận đơn {{order_code}} của bạn`.
3. Điền Test Data bằng nội dung `order-confirmation.sample.json`.
4. Tải logo lên nơi có URL HTTPS công khai, thay `logo_url` bằng URL ảnh thật. Đường dẫn `C:\...`, `localhost` hoặc `assets/...` không hoạt động trong Gmail của khách.
5. Thay `order_url` bằng URL website thật + ID đơn. Cần URL HTTPS khi dùng thực tế; đây không phải link đăng nhập tự động và không chứa access token.
6. Xem preview desktop/mobile trong SendGrid rồi lưu/activate version.

## Các biến

| Biến | Nội dung |
| --- | --- |
| `logo_url` | URL HTTPS logo; có thể dùng `cid:gomchoem-logo` nếu backend sau này đính kèm ảnh inline đúng content ID |
| `customer_name`, `order_code`, `order_date` | Tên khách, mã đơn, ngày đặt đã định dạng |
| `is_paid` | Boolean: chỉ true sau khi tiệm đã xác nhận tiền thực nhận |
| `payment_status`, `payment_method`, `payment_note` | Trạng thái, phương thức và hướng dẫn phù hợp |
| `items` | Mảng `{ name, sku, quantity, unit_price, line_total }` |
| `subtotal`, `discount`, `shipping_fee`, `total` | Chuỗi tiền đã định dạng sẵn, ví dụ `340.000đ`. `discount` truyền số dương, template tự thêm dấu trừ |
| `recipient_name`, `recipient_phone`, `shipping_address`, `shipping_method` | Thông tin nhận hàng; nhận tại tiệm thì truyền địa chỉ tiệm và ghi miễn phí giao hàng |
| `gift_note` | Lời nhắn; để rỗng thì ẩn khối này |
| `has_invoice_attachment` | Boolean: chỉ true khi lần gửi đó thực sự có tệp PDF đính kèm |
| `invoice_filename` | Tên PDF thật trong phần attachments |
| `order_url` | Link xem đơn, để rỗng thì ẩn nút |
| `shop_phone`, `shop_address` | Thông tin cửa hàng chính thức; để rỗng thì ẩn |
| `show_unsubscribe` | Mặc định false cho mẫu xác nhận giao dịch. Chỉ bật khi có đường dẫn unsubscribe/preferences hợp lệ do SendGrid cấp và phù hợp cấu hình email của bạn |

Tiền trong email phải do backend tính từ đơn đã lưu, không dùng giá trị do trình duyệt khách gửi lên.
Template dùng `{{variable}}` để escape tên khách, sản phẩm và lời nhắn; không đổi các trường này thành triple braces.
Hai biến unsubscribe triple braces được giữ từ module gốc của SendGrid và chỉ dùng giá trị do SendGrid cung cấp.

## Trạng thái thanh toán

- **COD:** `is_paid: false`, `payment_status: "Đặt hàng thành công · Thanh toán khi nhận hàng"`; note ghi số tiền phải trả khi nhận.
- **Chuyển khoản chờ đối soát:** `is_paid: false`, `payment_status: "Chờ tiệm xác nhận chuyển khoản"`; note nhắc tiệm đang kiểm tra tiền về, sản phẩm tiếp tục được giữ.
- **Đã nhận tiền:** `is_paid: true`; mẫu hiển thị “Đã xác nhận thanh toán”. Chỉ dùng sau khi nhân viên đối soát.

Không dùng dòng “thanh toán thành công” chỉ vì khách bấm “Tôi đã chuyển khoản”.

## PDF và logo không được gửi chỉ nhờ HTML

Mẫu HTML không tự tạo, tải hay đính kèm PDF. Khi tích hợp sau này, backend cần gọi Mail Send API với `template_id`, `dynamic_template_data` và `attachments` chứa PDF base64. Chỉ bật `has_invoice_attachment` sau khi đã chuẩn bị đúng attachment.
Nếu dùng logo inline: attachment ảnh phải có `disposition: "inline"`, `content_id: "gomchoem-logo"` và `logo_url: "cid:gomchoem-logo"`. Logo HTTPS là cách đơn giản để kiểm tra template trong SendGrid.

Biên nhận PDF hiện tại của dự án **không phải hóa đơn điện tử thuế**. Mẫu ghi rõ điều này ở chân email.

## Hiển thị và kiểm tra

Dùng table layout, CSS inline, font Arial/Helvetica hỗ trợ tiếng Việt, tối đa 640px; mobile chuyển thông tin giao hàng/thanh toán thành một cột.
Không dùng JavaScript, CSS Grid, Flexbox hoặc font web cần tải từ Google Fonts trong email.
Logo có alt text; nội dung đơn và nút vẫn đọc được khi Gmail chặn tải ảnh.

Bản preview local chỉ xác minh bố cục trong trình duyệt. Cần gửi test từ SendGrid tới Gmail/Outlook của bạn sau khi có tài khoản, sender và URL logo thật để xác minh hiển thị trong hộp thư thực tế.

Tài liệu chính thức: [Handlebars](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/using-handlebars), [Mail Send và attachments](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send).
