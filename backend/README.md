# Backend Gốm Cho Em

Next.js App Router + TypeScript + PostgreSQL 17 + Prisma 7 + Redis 7.

Hướng dẫn chạy, tài khoản local, nghiệp vụ và phạm vi tích hợp xem [README toàn dự án](../README.md).
Quy ước tổ chức code xem [docs/STRUCTURE.md](docs/STRUCTURE.md).

## Các lệnh chính

```powershell
npm install
npm run docker:up
npm run dev
```

`npm run dev` và `npm start` tự chạy migration PostgreSQL, generate Prisma Client và thêm dữ liệu mẫu còn thiếu trước khi mở server; không reset dữ liệu. `DB_SEED_ON_START=false` tắt seed (nên dùng khi triển khai). Môi trường dev tự tạo chủ tiệm nếu chưa có ADMIN, thông tin trong `.env.local`. PostgreSQL phải đang chạy; nếu khởi tạo thất bại, server không khởi động.

API và worker giữ hàng/đối soát VNPay/gửi email chạy cùng lệnh, dừng cùng nhau. Không cần mở worker riêng khi dùng lệnh trên. `npm run worker` chỉ dành cho triển khai worker độc lập. Các script dùng cùng thứ tự ưu tiên `.env.local` → `.env` như Next.js.

Database và Redis local: cổng 15432 / 16379, volume bền vững. Xem bảng tại database **backend → schema public → Tables**, refresh trong pgAdmin/DBeaver nếu chưa thấy. Thông số kết nối lấy từ `DATABASE_URL`, không phải một PostgreSQL khác trên cổng 5432.

Hướng dẫn cấu hình dịch vụ, callback và kiểm thử: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## API

Tất cả trả `{ success: true, data }` hoặc `{ success: false, error: { message, details? } }`.
Auth dùng `Authorization: Bearer <accessToken>`; JWT một giờ, xác nhận lại quyền từ DB.

| URL | Chức năng |
| --- | --- |
| POST /api/auth/register, /api/auth/login | Đăng ký / đăng nhập |
| GET /api/shop/products, /products/:slug, /categories, /settings | Catalogue và cấu hình công khai |
| GET/PUT /api/shop/account | Hồ sơ và hạng thành viên |
| POST/DELETE /api/shop/wishlist/:productId | Yêu thích |
| POST /api/shop/products/:slug/reviews | Đánh giá sau khi nhận hàng |
| POST /api/shop/reservations | Giữ cả giỏ trong 180 giây |
| GET /api/shop/orders, /orders/:id | Đơn của khách / chi tiết |
| POST /api/shop/orders/:id/quote, /submit, /cancel, /returns | Tính tiền, chốt, hủy, đổi trả |
| POST /api/shop/orders/:id/vnpay | Lấy lại URL phiên VNPay của khách đang đăng nhập |
| GET /api/shop/payments/vnpay/ipn | VNPay thông báo kết quả, kiểm tra chữ ký và số tiền |
| GET /api/shop/payments/vnpay/return | Khách xem kết quả đã xác minh; không tin trạng thái từ trình duyệt |
| POST /api/shop/admin/emails/:id | Chủ tiệm/thu ngân xếp hàng thử gửi lại email lỗi |
| GET /api/shop/orders/:id/invoice | Biên nhận PDF tiếng Việt |
| POST /api/shop/inquiries | Liên hệ công khai, giới hạn tần suất |
| POST /api/shop/uploads | Upload ảnh/video, cần đăng nhập |
| GET /api/shop/media/:filename | Đọc file với tên UUID |
| GET /api/shop/admin/dashboard, /orders, /products | Quản trị |
| PUT /api/shop/admin/orders/:id | Xác nhận tiền / đóng gói / gửi / giao / hủy |
| POST/PUT /api/shop/admin/products[/id] | Tạo / cập nhật sản phẩm |
| POST /api/shop/admin/stock, /pos | Nhập/điều chỉnh kho; bán hàng tại quầy hoặc FB/IG |
| POST /api/shop/admin/returns | Chủ tiệm tạo yêu cầu cho POS/hàng hoàn về |
| PUT /api/shop/admin/returns/:id | Duyệt / từ chối / nhận và kiểm tra |
| POST /api/shop/admin/vouchers | Lưu mã ưu đãi |
| PUT /api/shop/admin/inquiries/:id | Đánh dấu đã xử lý |
| PUT /api/shop/admin/users/:id | Cấp vai trò |
| PUT /api/shop/admin/settings | Địa chỉ, hotline, ngân hàng |

Route chỉ parse/validate, gọi service và trả response. Prisma truy vấn tại service/repository; transaction kho nằm trong repository helper. Shop route công khai ở proxy nhưng từng endpoint bảo vệ gọi requireUser và service kiểm tra quyền; không dựa vào ẩn nút frontend.

## Kiểm tra

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run db:check
```

`test:integration` dùng database tạm riêng rồi xóa, không dùng schema database dự án.
`npx tsx scripts/smoke-local.ts` kiểm tra HTTP qua Vite khi frontend/backend đang chạy; cần ADMIN_EMAIL và ADMIN_PASSWORD trong `.env.local`. Script chỉ thêm và dọn fixture do chính nó tạo.

Uploads có cấu hình Cloudinary được tải lên Cloudinary qua backend. Chỉ dev chưa cấu hình mới lưu tại `var/uploads`; endpoint media cũ vẫn đọc được file local. PDF dùng Noto Sans với giấy phép OFL tại `assets/fonts`.
Không commit `.env` hoặc các tài khoản/secret local. Khi đổi schema: tạo migration mới và commit cùng code, không sửa migration đã áp dụng.
