# Cấu hình Firebase Cloud Messaging

Đã tích hợp Firebase Web SDK, Firebase Admin SDK và FCM. Điền key trực tiếp vào file local, không gửi qua chat. Dữ liệu shop, thông báo và trạng thái đọc vẫn lưu PostgreSQL; không cần bật Firestore hay thay hệ thống đăng nhập JWT.

## Frontend: `frontend/.env`

Vào Firebase Console → Project settings → General → Your apps → ứng dụng Web. Chép các trường tương ứng:

| Firebase Web config | Biến môi trường |
| --- | --- |
| apiKey | VITE_FIREBASE_API_KEY |
| authDomain | VITE_FIREBASE_AUTH_DOMAIN |
| projectId | VITE_FIREBASE_PROJECT_ID |
| storageBucket | VITE_FIREBASE_STORAGE_BUCKET |
| messagingSenderId | VITE_FIREBASE_MESSAGING_SENDER_ID |
| appId | VITE_FIREBASE_APP_ID |

Vào Project settings → Cloud Messaging → Web Push certificates, chép public key vào `VITE_FIREBASE_VAPID_KEY`. Đây là public VAPID key, không phải private key của service account. Không cần Measurement ID hay databaseURL cho FCM.

## Backend: `backend/.env`

Lấy từ JSON service account trong Project settings → Service accounts:

| Trường JSON | Biến môi trường |
| --- | --- |
| project_id | FIREBASE_PROJECT_ID |
| client_email | FIREBASE_CLIENT_EMAIL |
| private_key | FIREBASE_PRIVATE_KEY |

Giữ khóa PEM trong dấu nháy kép, bao gồm BEGIN/END và các ký tự `\n` như trong JSON. Ví dụ định dạng (không phải key thật):

```dotenv
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nNOI_DUNG_KEY_CUA_BAN\n-----END PRIVATE KEY-----\n"
```

Không chép toàn bộ JSON vào FIREBASE_PRIVATE_KEY. Project ID frontend và backend phải cùng một Firebase project. Biến backend không được mang tiền tố VITE_ hoặc NEXT_PUBLIC_. Không lưu JSON service account trong frontend/public. Cả hai `.env` đã được Git ignore; `.env.example` chỉ chứa giá trị Firebase trống. Nếu có biến trùng trong `.env.local`, giá trị `.env.local` được ưu tiên.

Bật Firebase Cloud Messaging API (HTTP v1) cho project và cấp quyền gửi FCM phù hợp cho service account. Khi triển khai push Web cần HTTPS; localhost dùng được cho phát triển. Người dùng phải chủ động cấp quyền thông báo trong trình duyệt; giao diện vẫn cần đọc thông báo khi quyền push bị từ chối.

## Tính năng đã tích hợp

- Admin/nhân viên: đơn mới, lời nhắn mới, yêu cầu đổi trả/hoàn tiền theo đúng quyền truy cập.
- Khách: thay đổi trạng thái đơn, xác nhận thanh toán, cập nhật yêu cầu đổi trả của chính mình.
- Số cạnh menu Đơn hàng, Hộp thư tiệm, Đổi trả: thống nhất là số việc đang cần xử lý; FCM báo có thay đổi để frontend tải lại số từ API. Số chưa đọc của từng người dùng sẽ được theo dõi riêng.
- Thông báo, trạng thái đọc và token thiết bị lưu PostgreSQL. FCM là kênh chuyển push, không thay PostgreSQL làm nguồn dữ liệu đơn hàng/kho.
- Đăng ký token cần đăng nhập, gắn token với đúng tài khoản, hủy khi đăng xuất và dọn token hết hiệu lực. Không dùng topic công khai để chuyển dữ liệu đơn hàng riêng tư.

## Cách chạy và thử

1. Chạy `npm run dev` trong backend và frontend. Backend tự áp dụng migration tạo `Notification`, `PushToken`, `PushDelivery`; không xóa dữ liệu đang có. Worker FCM chạy cùng server, kiểm tra hàng đợi mỗi 10 giây. Khởi động lại cả hai server sau khi đổi `.env`.
2. Đăng nhập, mở chuông → **Bật thông báo đẩy**, cấp quyền trình duyệt. Mỗi trình duyệt cần bật riêng. Khi cấu hình Admin thiếu hoặc PEM không hợp lệ, nút bật bị khóa nhưng chuông trong website vẫn hoạt động.
3. Gửi đơn hàng/lời nhắn/đổi trả mới. Mở website bằng tài khoản có quyền để kiểm tra chuông và số cạnh menu; ẩn tab để kiểm tra push nền. Bấm thông báo trong website để mở đúng đơn hoặc tab quản trị. Khách chỉ thấy thông báo của mình.
4. Bấm **Đọc tất cả** hoặc mở một thông báo để giảm số chưa đọc. Số việc cạnh menu chỉ giảm khi việc được xử lý, không giảm theo thao tác đọc: đơn đã gửi đang `PENDING_PAYMENT`, `CONFIRMED`, `PACKING`; lời nhắn chưa giải quyết; đổi trả `REQUESTED` hoặc `APPROVED`.

Frontend khởi tạo tại `src/lib/firebase.js` (export `app`, `auth`). Backend tại `src/lib/firebaseAdmin.ts` khởi tạo lười để không làm hỏng checkout khi thiếu key: dùng `getAdminApp()`, `adminAuth()`, `adminDb()`, `adminMessaging()`. Hai export Auth/Firestore có sẵn, chưa dùng để thay đổi đăng nhập hoặc nguồn dữ liệu.

Service worker `src/firebase-messaging-sw.js` được Vite build thành `/firebase-messaging-sw.js` với scope `/`. Khi triển khai, phục vụ file này bằng JavaScript MIME đúng trên HTTPS, không chuyển request của file thành `index.html`. Chỉ config web công khai được đưa vào bundle, tuyệt đối không thêm private key Admin vào biến `VITE_`.

Thông báo nghiệp vụ và hàng đợi push được tạo bằng PostgreSQL trigger trong cùng transaction với đơn/lời nhắn/đổi trả; rollback không để lại thông báo. Không tạo hàng loạt thông báo cho dữ liệu cũ. API trả 50 thông báo gần nhất và tổng số chưa đọc. Frontend tải lại mỗi 10 giây/khi focus, FCM đến thì tải ngay. Các cập nhật khi đã tắt push vẫn nằm trong PostgreSQL.

Toast, chuông và push nền dùng cùng tiêu đề/nội dung của sự kiện đã lưu: tiếp nhận, xác nhận, đóng gói, bàn giao vận chuyển, giao thành công, hủy, thanh toán, hoàn tiền và xử lý đổi trả. Push có thể hiển thị mã đơn; không đưa tên khách, địa chỉ hoặc số điện thoại vào nội dung. Trạng thái giao hàng thay đổi được ưu tiên, nên đơn đã trả tiền khi đóng gói vẫn báo đóng gói, không báo lại thanh toán. Thông báo cũ giữ nguyên lịch sử; thông báo mới dùng nội dung mới sau migration. Logout hủy token thiết bị và xóa định danh người nhận trong service worker; đổi tài khoản sẽ xóa hàng đợi của chủ token cũ. Worker bỏ qua thông báo đã đọc/không còn quyền, xóa token hết hiệu lực, thử lại lỗi tạm thời tối đa 8 lần. FCM có thể giao lại; dùng notification ID làm tag để hạn chế trùng hiển thị.

## Nếu push chưa gửi được

- Project ID frontend và backend phải giống nhau; API từ chối đăng ký token nếu khác project.
- Private key phải là toàn bộ PEM từ service account JSON, không phải API key Web, không cắt ngắn hoặc thêm dấu ba chấm. Backend kiểm tra định dạng PEM trước khi cho bật push.
- Cấu hình đúng định dạng chưa bảo đảm tài khoản có quyền gửi. Kiểm tra Cloud Messaging API HTTP v1, service account và VAPID cùng project; xem `PushDelivery.status`, `attempts`, `lastError` để biết lỗi gửi (không chứa token/key).
- Nếu đã chặn thông báo, bật lại quyền trong cài đặt trình duyệt rồi nhấn bật ở chuông. Localhost dùng được, truy cập qua IP HTTP trong mạng LAN thường không có secure context.
- Kiểm thử tự động mock FCM để không gửi ra thiết bị thật. Cần một trình duyệt đã cấp quyền và key hợp lệ để xác nhận đường truyền FCM thật.

Nguồn: [Firebase Web FCM](https://firebase.google.com/docs/cloud-messaging/web/get-started), [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup).
