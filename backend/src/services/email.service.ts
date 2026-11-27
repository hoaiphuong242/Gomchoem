import path from "node:path";
import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { getPrisma } from "@/lib/prisma";
import { requiredEnv, sendgridReady } from "@/lib/integrations";
import { orderInclude } from "@/repositories/shop.repo";
import { invoicePdf } from "@/services/invoice.service";
import { publicSettings } from "@/services/account.service";
import { ApiError } from "@/lib/errors";
import type { AuthUser } from "@/services/auth.service";
import { sendgridError, SendgridDeliveryError } from "@/lib/sendgrid";

const money = (v: number) => `${v.toLocaleString("vi-VN")}đ`;
const methods = { COD: "Thanh toán khi nhận hàng (COD)", CASH: "Tiền mặt tại quầy", TRANSFER: "Chuyển khoản ngân hàng", VNPAY: "Thanh toán qua VNPay" };

export async function buildOrderEmail(orderId: string) {
  const order = await getPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { ...orderInclude, customer: { select: { email: true } } } });
  if (!order.customer?.email || !order.submittedAt || ["CANCELLED", "EXPIRED"].includes(order.status)) return null;
  const settings = await publicSettings();
  const paid = order.paymentStatus === "PAID";
  const filename = `Bien-nhan-${order.code}.pdf`;
  const pdf = await invoicePdf(order);
  const logo = process.env.SENDGRID_LOGO_URL?.trim();
  const templateData = {
    logo_url: logo || "cid:gomchoem-logo", customer_name: order.recipientName,
    order_code: order.code, order_date: order.submittedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
    is_paid: paid, payment_status: paid ? "Đã xác nhận thanh toán" : order.paymentStatus === "AWAITING_REVIEW" ? "Chờ nhân viên xác nhận chuyển khoản" : "Đặt hàng thành công · Chưa thanh toán",
    items: order.items.map(i => ({ name: i.name, sku: i.sku, quantity: i.quantity, unit_price: money(i.unitPrice), line_total: money(i.quantity * i.unitPrice) })),
    subtotal: money(order.subtotal), discount: money(order.discount), shipping_fee: money(order.shippingFee), total: money(order.total),
    recipient_name: order.recipientName, recipient_phone: order.phone,
    shipping_address: order.pickup ? settings.address || "Nhận tại cửa hàng Gốm Cho Em" : `${order.address}, ${order.city}`,
    shipping_method: order.pickup ? "Nhận tại cửa hàng" : "Giao tận nơi · Đóng gói chống sốc",
    payment_method: methods[order.paymentMethod],
    payment_note: paid ? "Tiệm đã nhận đủ tiền. Bạn không cần thanh toán thêm." : order.paymentMethod === "TRANSFER" ? "Tiệm đang đối soát ngân hàng và tiếp tục giữ hàng. Email này chưa phải xác nhận đã thu tiền." : `Bạn thanh toán ${money(order.total)} khi nhận hàng.`,
    gift_note: order.giftWrap ? order.note || "Tiệm sẽ gói quà và chuẩn bị thiệp cho bạn." : "",
    has_invoice_attachment: true, invoice_filename: filename,
    order_url: new URL(`/don-hang/${order.id}`, requiredEnv("APP_FRONTEND_URL")).toString(),
    shop_phone: settings.phone, shop_address: settings.address || "Đà Nẵng, Việt Nam", show_unsubscribe: false,
  };
  const attachments = [{ content: pdf.toString("base64"), filename, type: "application/pdf", disposition: "attachment", content_id: "receipt" }];
  if (!logo) attachments.push({ content: (await readFile(path.join(process.cwd(), "templates/email/assets/gomchoem-logo.jpg"))).toString("base64"), filename: "gomchoem-logo.jpg", type: "image/jpeg", disposition: "inline", content_id: "gomchoem-logo" });
  const templateId = process.env.SENDGRID_ORDER_TEMPLATE_ID?.trim();
  const subject = paid ? `Gốm Cho Em xác nhận thanh toán đơn ${order.code}` : `Gốm Cho Em đã nhận đơn ${order.code} của bạn`;
  return {
    from: { email: requiredEnv("SENDGRID_FROM_EMAIL"), name: process.env.SENDGRID_FROM_NAME || "Gốm Cho Em" },
    ...(process.env.SENDGRID_REPLY_TO_EMAIL?.trim() ? { reply_to: { email: process.env.SENDGRID_REPLY_TO_EMAIL.trim() } } : {}),
    personalizations: [{ to: [{ email: order.customer.email, name: order.recipientName }], ...(templateId ? { dynamic_template_data: templateData } : {}) }],
    subject,
    ...(templateId ? { template_id: templateId } : { content: [{ type: "text/html", value: Handlebars.compile(await readFile(path.join(process.cwd(), "templates/email/order-confirmation.html"), "utf8"))(templateData) }] }),
    attachments,
    tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
  };
}

// Durable PostgreSQL outbox: mail failures never roll back a confirmed order.
// SendGrid has no Mail Send idempotency key: a crash after acceptance can rarely duplicate a mail.
export async function processEmails() {
  if (!sendgridReady()) return;
  const db = getPrisma();
  const now = new Date();
  const jobs = await db.emailDelivery.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, take: 10, orderBy: { createdAt: "asc" } });
  for (const job of jobs) {
    const claim = await db.emailDelivery.updateMany({ where: { id: job.id, status: "PENDING", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, data: { lockedUntil: new Date(Date.now() + 120_000), attempts: { increment: 1 } } });
    if (!claim.count) continue;
    try {
      const payload = await buildOrderEmail(job.orderId);
      if (!payload) {
        await db.emailDelivery.update({ where: { id: job.id }, data: { status: "SKIPPED", lockedUntil: null } });
        continue;
      }
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: `Bearer ${requiredEnv("SENDGRID_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000) });
      if (response.status !== 202) throw await sendgridError(response);
      await db.emailDelivery.update({ where: { id: job.id }, data: { status: "SENT", sentAt: new Date(), messageId: response.headers.get("x-message-id"), lockedUntil: null, lastError: null } });
    } catch (error) {
      // Store only a safe message: never log API keys, recipient details or provider response bodies.
      const safeError = error instanceof SendgridDeliveryError ? error.message : "Chưa gửi được email. Kiểm tra cấu hình email và nhật ký kết nối.";
      const failed = (error instanceof SendgridDeliveryError && error.permanent) || job.attempts >= 7;
      await db.emailDelivery.update({ where: { id: job.id }, data: { status: failed ? "FAILED" : "PENDING", lastError: safeError, lockedUntil: null, nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000) } });
      console.error(failed ? "Email đơn hàng cần sửa cấu hình trước khi gửi lại:" : "Email đơn hàng sẽ thử lại:", job.id, safeError);
    }
  }
}

export async function retryEmail(actor: AuthUser, id: string) {
  if (!["ADMIN", "CASHIER"].includes(actor.role)) throw new ApiError("Bạn không có quyền gửi lại email", 403);
  const job = await getPrisma().emailDelivery.findUnique({ where: { id } });
  if (!job) throw new ApiError("Không tìm thấy email đơn hàng", 404);
  if (job.status === "SENT") throw new ApiError("Email đã được dịch vụ chấp nhận gửi", 409);
  if (job.lockedUntil && job.lockedUntil > new Date()) throw new ApiError("Email đang được gửi, vui lòng chờ", 409);
  const updated = await getPrisma().emailDelivery.updateMany({ where: { id, status: { in: ["FAILED", "PENDING"] }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null } });
  if (!updated.count) throw new ApiError("Không thể gửi lại email này", 409);
  return { queued: true };
}
