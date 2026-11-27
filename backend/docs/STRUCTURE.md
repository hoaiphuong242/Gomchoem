# Cấu trúc backend

Next.js App Router làm API server, TypeScript, Prisma và PostgreSQL.
Giữ kiến trúc phân lớp hiện có để thống nhất với mã nguồn và test.

```text
backend/
├── prisma/
│   ├── schema.prisma          # Model và enum
│   └── migrations/            # Lịch sử thay đổi database
├── src/
│   ├── app/api/               # Route handler theo quy ước Next.js
│   │   ├── auth/login/route.ts
│   │   ├── auth/register/route.ts
│   │   ├── users/route.ts
│   │   ├── users/[id]/route.ts
│   │   └── health/route.ts
│   ├── schemas/               # Zod schema và kiểu input
│   ├── services/              # Nghiệp vụ, xác thực và phân quyền
│   ├── repositories/          # Truy vấn Prisma
│   ├── config/                # Cấu hình và kiểm tra biến môi trường
│   ├── integrations/          # Adapter dịch vụ ngoài, ví dụ Cloudinary
│   ├── lib/                   # Prisma/Redis, JWT, request/response, lỗi
│   ├── types/                 # Kiểu dùng chung
│   ├── generated/prisma/      # Client tự sinh, được gitignore
│   └── proxy.ts               # CORS và kiểm tra JWT bước đầu
├── scripts/                   # Script vận hành và kiểm tra kết nối
├── tests/
│   ├── api.test.ts            # Test hiện có, không cần database
│   └── integration/           # Test tích hợp DB/dịch vụ sau này
├── docs/
├── prisma.config.ts
└── docker-compose.yml         # PostgreSQL và Redis local
```

## Quy ước

- Luồng chính: route → validate schema → service → repository → database.
- Route đọc request, validate input, gọi service và chuẩn hóa response; không gọi Prisma trực tiếp.
- Service xử lý nghiệp vụ và phân quyền. Repository phụ trách truy vấn database.
- Đặt tên theo mã hiện có: `auth.service.ts`, `user.repo.ts`, `user.schema.ts`, `api.type.ts`.
- Alias `@/` trỏ tới `src/`.
- Client Prisma/Redis đã ở `lib`; không tạo bản sao trong `integrations`.
- `integrations` chứa adapter dịch vụ ngoài; `config` chứa cấu hình, không chứa nghiệp vụ.
- Kiểu chỉ dùng trong một module đặt gần module đó; `types` dành cho kiểu dùng chung.
- Sinh Prisma Client bằng `npm run db:generate`; không sửa file tự sinh.
- Khi đổi dữ liệu, cập nhật schema và tạo migration cùng thay đổi nghiệp vụ.
- Không commit secret hoặc `.env`; dùng `.env.example` mô tả cấu hình.
- `.gitkeep` giữ thư mục trống trong Git; có thể xóa khi có file thật.

## Kiểm tra

Các lệnh lint, typecheck, test và build đã có trong package.json.
`npm test` chạy `tests/*.test.ts`. `npm run test:integration` tạo database tạm riêng,
áp dụng migration rồi chạy `tests/integration/shop.test.ts` và dọn database đó.
Không reset dữ liệu dự án để kiểm thử. `scripts/smoke-local.ts` kiểm thử HTTP local.

Trước khi viết code Next.js, đọc hướng dẫn liên quan trong
`node_modules/next/dist/docs/` theo `AGENTS.md`.
