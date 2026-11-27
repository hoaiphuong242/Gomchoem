# Cấu trúc frontend

React + Vite, JavaScript/JSX, Tailwind CSS và shadcn/ui. Tổ chức theo tính năng.

```text
frontend/
├── public/                    # File tĩnh phục vụ trực tiếp
├── src/
│   ├── app/
│   │   ├── router/            # Route và route guard
│   │   └── providers/         # Provider cấp ứng dụng
│   ├── assets/                # Ảnh, SVG được import
│   ├── components/
│   │   ├── ui/                # UI primitives của shadcn/Base UI
│   │   └── common/            # Component ứng dụng dùng chung
│   ├── layouts/               # Bố cục các trang
│   ├── pages/                 # Màn hình tương ứng với route
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/    # Component riêng của tính năng
│   │   │   ├── hooks/         # Logic React của tính năng
│   │   │   ├── schemas/       # Zod schema cho form/input
│   │   │   └── services/      # Gọi API của tính năng
│   │   └── users/             # Cùng cấu trúc với auth
│   ├── hooks/                 # Hook dùng chung nhiều tính năng
│   ├── services/api/          # HTTP client, cấu hình API, xử lý lỗi chung
│   ├── stores/                # Zustand state dùng chung toàn ứng dụng
│   ├── constants/             # Hằng số dùng chung
│   ├── lib/                   # cn và tiện ích tích hợp thư viện
│   ├── App.jsx                # Component gốc
│   ├── App.css
│   ├── index.css              # Tailwind, theme và style toàn cục
│   └── main.jsx               # Mount React
├── tests/
│   ├── unit/
│   └── integration/
└── docs/
```

## Quy ước

- `pages` ghép layout và component từ `features`; logic nghiệp vụ nằm trong tính năng.
- Component dùng PascalCase (`LoginForm.jsx`); hook dùng tiền tố `use` (`useLogin.js`).
- Service dùng tên `auth.service.js`, schema dùng `auth.schema.js`, store dùng `auth.store.js`.
- Store chỉ phục vụ một tính năng đặt trong tính năng đó khi cần; `src/stores` dành cho state dùng chung.
- Component không tự tạo HTTP client. Service tính năng dùng client chung trong `services/api`.
- Ưu tiên UI có sẵn trong `components/ui`; component ứng dụng tái sử dụng đặt ở `components/common`.
- Alias `@/` trỏ tới `src/`, đã cấu hình trong Vite và jsconfig.
- Chỉ thêm `stores/`, `utils/`, `constants/` trong tính năng khi cần thực tế.
- `.gitkeep` giữ thư mục trống trong Git; có thể xóa khi có file thật.

## Triển khai hiện tại

- `features/auth/components/AuthPage.jsx`: đăng nhập và đăng ký.
- `features/catalog/pages`: catalogue và chi tiết sản phẩm.
- `features/admin/components`: dashboard, đơn, sản phẩm, kho, POS, trả hàng, voucher, nhân viên và cấu hình.
- `pages`: trang chủ, liên hệ, chính sách, giỏ/checkout, tài khoản và đơn hàng.
- `app/router/Router.jsx`: router cấp ứng dụng; `layouts/StoreLayout.jsx`: header/footer khách hàng.
- `services/api/client.js`: JSON API, upload, tải PDF; token phiên đăng nhập nằm trong sessionStorage.
- `stores/shop.store.js`: giỏ hàng bền vững và phiên người dùng.
- `styles`: chia CSS cửa hàng, quản trị và responsive.

Những thư mục `.gitkeep` còn trống dành cho phần mở rộng khi cần.
Chưa cấu hình test runner frontend; xem README để chạy kiểm tra lint/build và kiểm thử backend.
