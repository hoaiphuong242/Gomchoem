# Frontend Gốm Cho Em

React 19 + Vite + JavaScript/JSX + Tailwind CSS 4, React Router, Zustand và Sonner.
Theme nền sáng kem/nâu đất theo nhóm màn hình Stitch đã thống nhất.

## Chạy

```powershell
npm install
npm run dev
```

Mở http://127.0.0.1:5173. Vite proxy `/api` tới http://127.0.0.1:3000.
API backend và reservation worker cần chạy; xem [README dự án](../README.md).

## Màn hình

- `/`: trang chủ.
- `/san-pham`, `/san-pham/:slug`: tìm/lọc/sắp xếp và chi tiết sản phẩm.
- `/gio-hang`, `/thanh-toan`: giỏ và phiên giữ hàng 3 phút.
- `/dang-nhap`, `/tai-khoan`, `/don-hang/:id`: tài khoản, wishlist, lịch sử và đổi trả.
- `/ve-tiem`, `/lien-he`, `/chinh-sach`: nội dung cửa hàng và chính sách.
- `/quan-tri`: dashboard, sản phẩm, kho, POS, đơn, hoàn trả, hộp thư, voucher, phân quyền và cấu hình tiệm.

`src/app/router` ghép các route; `src/pages` chứa màn hình; `src/services/api` quản lý request và tải PDF;
`src/stores` giữ giỏ (localStorage) và phiên đăng nhập (sessionStorage); `src/hooks/useRemote` cập nhật dữ liệu mỗi 5 giây;
`src/components/common` chứa UI dùng chung; `src/styles` chia style cửa hàng, admin và responsive.
Các UI primitives tại `src/components/ui` vẫn sẵn có để mở rộng.

## Kiểm tra

```powershell
npm run lint
npm run build
```

Chưa cài frontend unit-test runner. Luồng nghiệp vụ được kiểm thử tại backend bằng unit/integration/HTTP smoke;
giao diện đã được mở kiểm tra local. Không dùng số liệu giả ở dashboard khi backend mất kết nối: hiển thị lỗi tải dữ liệu.

## Nội dung và tích hợp

Sản phẩm/ảnh seed là minh họa, thay bằng ảnh thật trước khi mở bán.
Chủ tiệm điền thông tin liên hệ và ngân hàng trong admin. Chưa có cấu hình ngân hàng thì chuyển khoản trên checkout được tắt, COD vẫn hoạt động.
Biên nhận PDF có thể tải/in, chưa gửi email tự động hoặc tích hợp hóa đơn điện tử thuế. Các tích hợp còn lại ghi trong README dự án.
