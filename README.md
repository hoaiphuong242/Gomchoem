# Gốm Cho Em

Website bán gốm secondhand, quản lý tồn kho chung, đơn website/Facebook/Instagram và POS tại một cửa hàng Đà Nẵng.

## Chạy local

Yêu cầu Node.js 22.12+ và Docker Desktop (Linux containers).

Trong `backend`:

```powershell
npm install
# Sao chép .env.example thành .env nếu chưa có; giữ cấu hình hiện có.
npm run docker:up
npm run dev
```

`db:seed` thêm 5 danh mục, 8 sản phẩm minh họa và mã CHAOEM, không reset tồn kho hoặc ghi đè sản phẩm đã có.
`setup:local` chỉ tạo chủ tiệm nếu chưa có ADMIN; mật khẩu ngẫu nhiên lưu tại `backend/.env.local` (ADMIN_EMAIL, ADMIN_PASSWORD). Không dùng tài khoản local trên production.
JWT_SECRET cần có ít nhất 32 bytes. API, Prisma và worker đều ưu tiên `.env.local` rồi `.env`.

`npm run dev` tự áp dụng migration PostgreSQL, generate client và seed dữ liệu còn thiếu trước khi mở API; đồng thời chạy worker giữ hàng, đối soát VNPay và gửi email mỗi 10 giây. Không cần terminal worker riêng. Đặt `DB_SEED_ON_START=false` để tắt dữ liệu mẫu khi triển khai.

Mở terminal thứ hai trong `frontend`:

```powershell
npm install
npm run dev
```

- Cửa hàng: http://127.0.0.1:5173
- Quản trị: http://127.0.0.1:5173/quan-tri
- API: http://localhost:3000/api
- PostgreSQL: localhost:15432; Redis: localhost:16379

Vite chuyển tiếp `/api` tới backend. CORS đã có cả localhost:5173 và 127.0.0.1:5173. Khi triển khai, cấu hình reverse proxy `/api` hoặc VITE_API_URL và CORS_ORIGINS tương ứng.

## Thiết lập cửa hàng

1. Đăng nhập tài khoản chủ tiệm (thông tin trong `.env.local`).
2. Vào **Quản trị → Thông tin cửa hàng**, điền địa chỉ, giờ mở cửa, hotline và tài khoản ngân hàng công khai. Checkout chuyển khoản được bật khi có số tài khoản.
3. Thay ảnh và mô tả mẫu bằng dữ liệu thật tại **Sản phẩm**. Mỗi mẫu/SKU là một sản phẩm, không bán theo bộ.
4. Ghi số lượng thực tế tại **Tồn kho & nhập hàng**.
5. Nhân viên tự đăng ký tài khoản; chủ tiệm cấp vai trò CASHIER/WAREHOUSE trong mục **Tài khoản & nhân viên**.

## Chức năng đã triển khai

| Khu vực | Chức năng |
| --- | --- |
| Khách hàng | Trang chủ, catalogue, tìm kiếm, danh mục, lọc, sắp xếp, phân trang, chi tiết ảnh/zoom, mô tả tình trạng |
| Tài khoản | Đăng ký/đăng nhập, địa chỉ, lịch sử đơn, bộ sưu tập, wishlist, đánh giá sau khi nhận hàng |
| Đặt hàng | Giỏ, kiểm tra tồn kho, giữ 3 phút, VNPay/COD/chuyển khoản thủ công, nhận tại tiệm, gói quà, voucher, hạng thành viên |
| Đơn hàng | Theo dõi trạng thái, mã vận đơn, lịch sử thao tác, hủy trước khi gửi, yêu cầu đổi trả 48 giờ, biên nhận PDF tiếng Việt |
| Quản trị | Dashboard, sản phẩm/ảnh, nhập và điều chỉnh kho, sổ kho, quản lý đơn, duyệt thanh toán, POS/in bill, tạo đơn FB/IG |
| Chăm sóc | Hộp thư liên hệ, tải ảnh tham khảo, video minh chứng, duyệt đổi trả, kiểm tra/nhập lại kho, ghi nhận hoàn tiền |
| Cấu hình | Voucher, phân quyền chủ/thu ngân/kho, thông tin liên hệ và ngân hàng |

Hạng thành viên là quy tắc khởi tạo có thể đổi trong `backend/src/lib/shop-rules.ts`: từ 10 món đã nhận giảm 5%, từ 20 món giảm 10%; đơn đã nhận hoàn trả không tính vào tích lũy. Voucher giảm tiền cố định, có đơn tối thiểu, hạn dùng và giới hạn tổng lượt.

Hướng dẫn VNPay Return/IPN, SendGrid, Cloudinary và khởi tạo PostgreSQL: [backend/docs/INTEGRATIONS.md](backend/docs/INTEGRATIONS.md).

## Quy tắc tồn kho

- **Có thể bán = thực có − đang giữ.** Giỏ hàng phía trình duyệt chưa giữ hàng.
- Vào checkout tạo một phiên giữ 180 giây. Đổi giỏ kết thúc phiên cũ; gọi lại cùng giỏ không kéo dài thời hạn.
- Chốt COD → CONFIRMED. Báo đã chuyển tiền → PENDING_PAYMENT / AWAITING_REVIEW, tiếp tục giữ để nhân viên kiểm tra. Không tự coi nút này là tiền đã về.
- Chủ/thu ngân chỉ xác nhận chuyển khoản thủ công sau khi đã kiểm tra ngân hàng. VNPay được xác nhận bằng IPN/QueryDR đã kiểm tra chữ ký và số tiền; giữ hàng trong phiên 15 phút, xử lý lỗi/tiền về muộn theo tài liệu tích hợp.
- Bàn giao shipper hoặc giao tại tiệm: trừ thực có và đang giữ. POS tại quầy giao hàng/thu tiền ngay thì trừ thực có trong cùng transaction.
- Hủy trước bàn giao: giải phóng hàng đang giữ. Hủy sau bàn giao: không tự tạo hàng trong kho; tiếp nhận hàng hoàn về qua quy trình trả hàng.
- Đơn đã trả tiền chỉ chủ tiệm được hủy sau khi ghi nhận đã hoàn tiền thực tế. Khoản hoàn là sổ đối soát, không phát lệnh chuyển tiền.
- Đổi trả 48 giờ tính từ deliveredAt. Chỉ nhập lại sản phẩm sau khi chủ xác nhận nhận hàng và tình trạng có thể bán. Hàng vỡ không nhập lại để bán.
- PostgreSQL Serializable + retry và CHECK constraints bảo vệ kho. Redis dùng rate limit auth/upload/liên hệ; không phải nguồn quyết định tồn kho.
- Giao diện cập nhật dữ liệu mỗi 5 giây; thao tác đặt hàng/POS luôn xác nhận tồn kho lại trên server.

## Phạm vi còn cần dữ liệu/dịch vụ ngoài

- **Ảnh thật và nội dung chính thức:** catalogue hiện là dữ liệu minh họa Unsplash, không phải ảnh/sản phẩm được xác minh từ Instagram. Thiết kế được triển khai theo hướng nền sáng của Stitch, không phải bản export pixel-perfect.
- **Hóa đơn điện tử thuế:** hiện có biên nhận PDF tải/in; chưa tích hợp nhà cung cấp hóa đơn điện tử.
- **Email giao dịch:** đã nối SendGrid gửi xác nhận đơn và biên nhận PDF đến email đăng ký, có hàng đợi PostgreSQL và retry. Chưa gửi newsletter/SMS.
- **Instagram feed, FB/IG inbox và vận chuyển:** liên kết Instagram và nhập đơn thủ công; chưa tự lấy bài đăng/đơn, chưa nối API vận chuyển. Nhân viên nhập mã vận đơn/cập nhật giao thành công.
- **Đổi mẫu:** xử lý nhận lại/hoàn tiền, rồi tạo đơn mới cho mẫu thay thế để kiểm tra lại tồn. Phiên bản này tiếp nhận trả toàn bộ đơn; chưa có màn hình trả riêng từng dòng hàng.
- **Chuyển khoản muộn/sai nội dung:** khách liên hệ tiệm; chủ đối soát, tạo đơn thủ công khi còn hàng hoặc hoàn tiền thực tế. Không tự xác nhận bằng ảnh biên lai.
- **Đính kèm:** ảnh sản phẩm/liên hệ và video mở kiện được upload lên Cloudinary khi có key. File local cũ vẫn đọc được. Chưa hỗ trợ video trong gallery sản phẩm hoặc tự dọn file Cloudinary không còn dùng.
- **Khôi phục mật khẩu, refresh token:** chưa có luồng email khôi phục hoặc refresh token; phiên JWT một giờ, hết hạn cần đăng nhập lại.

## Kiểm tra

Trong `backend`:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run db:check
```

Integration test tự tạo database tạm có tên `gce_test_*`, áp dụng migration, kiểm tra tranh chấp kho/giữ hàng/COD/chuyển khoản/hoàn trả/POS/voucher/PDF rồi xóa đúng database đó. Tài khoản PostgreSQL cần quyền tạo database; không dùng database production để chạy test. Không reset database dự án.

Trong `frontend`: `npm run lint` và `npm run build`.

## Vận hành

Sao lưu PostgreSQL và thư mục uploads; dùng HTTPS, secret riêng, phân quyền mạng và process manager cho API + worker khi triển khai. Docker Compose hiện dành cho local, cổng chỉ publish trên 127.0.0.1. Không chạy `down -v` nếu cần giữ dữ liệu.

Danh sách admin giới hạn 200 đơn gần nhất, dashboard tối đa 1.000 bản ghi và 1.000 sản phẩm trong phiên bản đầu. Cần bổ sung phân trang/báo cáo SQL tổng hợp khi mở rộng dữ liệu vượt mức này.
