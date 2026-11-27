import "./load-env";
import { v2 as cloudinary } from "cloudinary";
import { cloudinaryReady, sendgridReady, vnpayReady, requiredEnv } from "../src/lib/integrations";

// No real email or payment. SendGrid sandbox mode validates only the API request.
async function main() {
  console.log(`VNPay: ${vnpayReady() ? "đủ cấu hình tạo URL; cần thử giao dịch sandbox qua trình duyệt" : "chưa đủ cấu hình"}`);
  if (cloudinaryReady()) {
    try {
      const result = await cloudinary.api.ping({ cloud_name: requiredEnv("CLOUDINARY_CLOUD_NAME"), api_key: requiredEnv("CLOUDINARY_API_KEY"), api_secret: requiredEnv("CLOUDINARY_API_SECRET"), timeout: 15_000 });
      console.log(`Cloudinary: ${result.status === "ok" ? "xác thực kết nối thành công" : "phản hồi chưa xác định"}`);
    } catch { console.log("Cloudinary: xác thực thất bại hoặc lỗi mạng; kiểm tra cấu hình/hạn mức."); process.exitCode = 1; }
  } else console.log("Cloudinary: chưa đủ cấu hình");
  if (sendgridReady()) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${requiredEnv("SENDGRID_API_KEY")}` },
        body: JSON.stringify({ from: { email: requiredEnv("SENDGRID_FROM_EMAIL") }, personalizations: [{ to: [{ email: "integration-check@example.com" }] }], subject: "Sandbox validation only", content: [{ type: "text/plain", value: "Configuration check. No email will be sent." }], mail_settings: { sandbox_mode: { enable: true } } }), signal: AbortSignal.timeout(15_000),
      });
      console.log(`SendGrid sandbox: HTTP ${response.status}${response.status === 200 ? " · yêu cầu hợp lệ, không gửi email thật" : " · cần kiểm tra key/sender/quyền hoặc kết nối"}`);
      if (response.status !== 200) process.exitCode = 1;
    } catch { console.log("SendGrid sandbox: chưa kết nối được."); process.exitCode = 1; }
  } else console.log("SendGrid: chưa đủ cấu hình");
}
main().catch(() => { console.error("Kiểm tra tích hợp thất bại; không in secret."); process.exitCode = 1; });
