import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { requiredEnv } from "@/lib/integrations";
import { hmac, paymentUrl, verifyCallback, verifyQueryResponse, vnpDate } from "@/lib/vnpay";
import { transaction } from "@/repositories/shop.repo";
import type { AuthUser } from "@/services/auth.service";

// Only authenticated gateway results may move inventory or mark an order paid.
async function settle(fields: Record<string, string>, failureConfirmed = false) {
  return transaction(async tx => {
    const payment = await tx.paymentAttempt.findUnique({ where: { reference: fields.vnp_TxnRef }, include: { order: { include: { items: true } } } });
    if (!payment) return { RspCode: "01", Message: "Order not found" };
    if (!/^\d+$/.test(fields.vnp_Amount ?? "") || BigInt(fields.vnp_Amount) !== BigInt(payment.amount) * BigInt(100))
      return { RspCode: "04", Message: "Invalid amount" };
    if (payment.status === "PAID") return { RspCode: "02", Message: "Order already confirmed" };
    const success = fields.vnp_ResponseCode === "00" && fields.vnp_TransactionStatus === "00";
    const failed = failureConfirmed || (fields.vnp_TransactionStatus === "02" && fields.vnp_ResponseCode !== "07");
    const o = payment.order;
    if (success) {
      if (!/^[0-9]{1,15}$/.test(fields.vnp_TransactionNo ?? "") || fields.vnp_TransactionNo === "0") return { RspCode: "99", Message: "Missing transaction number" };
      const already = await tx.paymentAttempt.findUnique({ where: { transactionNo: fields.vnp_TransactionNo } });
      if (already && already.id !== payment.id) return { RspCode: "99", Message: "Transaction already used" };
      const active = o.status === "PENDING_PAYMENT" && payment.status === "PENDING";
      await tx.paymentAttempt.update({ where: { id: payment.id }, data: { status: active ? "PAID" : "REVIEW", transactionNo: fields.vnp_TransactionNo, responseCode: fields.vnp_ResponseCode, lastError: null } });
      if (payment.status === "REVIEW" && payment.transactionNo === fields.vnp_TransactionNo) return { RspCode: "02", Message: "Already recorded for review" };
      await tx.order.update({ where: { id: o.id }, data: {
        paymentStatus: active ? "PAID" : "AWAITING_REVIEW", paidAt: new Date(),
        ...(active ? { status: "CONFIRMED", expiresAt: null } : {}),
        events: { create: { message: active ? `VNPay đã xác nhận thanh toán. Mã giao dịch: ${fields.vnp_TransactionNo}.` : "VNPay báo tiền về sau khi đơn đã kết thúc. Chủ tiệm cần đối soát và hoàn tiền; không tự lấy lại hàng đã nhả." } },
      } });
      if (active) await tx.emailDelivery.upsert({ where: { orderId_kind: { orderId: o.id, kind: "ORDER_RECEIVED" } }, create: { orderId: o.id, kind: "ORDER_RECEIVED" }, update: {} });
    } else if (failed && payment.status === "PENDING" && o.status === "PENDING_PAYMENT") {
      await tx.paymentAttempt.update({ where: { id: payment.id }, data: { status: "FAILED", responseCode: fields.vnp_ResponseCode, lastError: null } });
      await tx.order.update({ where: { id: o.id }, data: { status: "EXPIRED", expiresAt: null, events: { create: { message: "VNPay xác nhận giao dịch không thành công. Đã nhả hàng để bạn chọn lại." } } } });
      for (const i of o.items) await tx.inventory.update({ where: { productId: i.productId }, data: { reserved: { decrement: i.quantity } } });
      if (o.voucherCode) await tx.voucher.update({ where: { code: o.voucherCode }, data: { used: { decrement: 1 } } });
    }
    return { RspCode: "00", Message: "Confirm Success" };
  });
}

export async function receiveIpn(params: URLSearchParams) {
  const fields = verifyCallback(params);
  if (!fields) return { RspCode: "97", Message: "Invalid signature" };
  return settle(fields);
}

export async function checkoutPayment(actor: AuthUser, id: string, request: Request) {
  const p = await getPrisma().paymentAttempt.findUnique({ where: { orderId: id }, include: { order: true } });
  if (!p || p.order.customerId !== actor.id) throw new ApiError("Không tìm thấy phiên thanh toán", 404);
  if (p.status !== "PENDING" || p.expiresAt <= new Date() || p.order.status !== "PENDING_PAYMENT") throw new ApiError("Phiên VNPay đã kết thúc. Vui lòng xem trạng thái đơn hàng.", 409);
  const forwarded = process.env.TRUST_PROXY === "true" ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : null;
  return { url: paymentUrl(p, forwarded && isIP(forwarded) ? forwarded : "127.0.0.1"), expiresAt: p.expiresAt };
}

export async function returnResult(actor: AuthUser, params: URLSearchParams) {
  const fields = verifyCallback(params);
  if (!fields) throw new ApiError("Kết quả VNPay không hợp lệ hoặc đã bị thay đổi", 422);
  const p = await getPrisma().paymentAttempt.findUnique({ where: { reference: fields.vnp_TxnRef }, include: { order: true } });
  if (!p || p.order.customerId !== actor.id) throw new ApiError("Không tìm thấy thanh toán của bạn", 404);
  // Verify the full gateway-signed return on the server, then use the same
  // amount/transaction checks and idempotent transaction as IPN. Never trust
  // a response code supplied by the browser without its HMAC.
  if ((fields.vnp_ResponseCode === "00" && fields.vnp_TransactionStatus === "00") || (fields.vnp_TransactionStatus === "02" && fields.vnp_ResponseCode !== "07")) {
    const result = await settle(fields);
    if (!["00", "02"].includes(result.RspCode)) throw new ApiError("Không thể xác nhận kết quả VNPay: thông tin giao dịch không khớp đơn hàng", 422);
  } else if (p.status === "PENDING") await reconcilePayment(p.id).catch(() => undefined);
  const current = await getPrisma().paymentAttempt.findUniqueOrThrow({ where: { id: p.id }, include: { order: true } });
  return { orderId: current.orderId, code: current.order.code, paymentStatus: current.order.paymentStatus, status: current.status, responseCode: fields.vnp_ResponseCode };
}

export async function reconcilePayment(id: string) {
  const db = getPrisma();
  const now = new Date();
  const claim = await db.paymentAttempt.updateMany({ where: { id, status: "PENDING", nextCheckAt: { lte: now } }, data: { nextCheckAt: new Date(now.getTime() + 5 * 60_000) } });
  if (!claim.count) return;
  const p = await db.paymentAttempt.findUniqueOrThrow({ where: { id } });
  try {
  const input: Record<string,string> = {
    vnp_RequestId: randomUUID().replaceAll("-", ""), vnp_Version: "2.1.0", vnp_Command: "querydr",
    vnp_TmnCode: requiredEnv("VNPAY_TMN_CODE"), vnp_TxnRef: p.reference,
    vnp_TransactionDate: vnpDate(p.createdAt), vnp_CreateDate: vnpDate(now),
    vnp_IpAddr: "127.0.0.1", vnp_OrderInfo: `Kiem tra thanh toan ${p.reference}`,
  };
  input.vnp_SecureHash = hmac(["vnp_RequestId","vnp_Version","vnp_Command","vnp_TmnCode","vnp_TxnRef","vnp_TransactionDate","vnp_CreateDate","vnp_IpAddr","vnp_OrderInfo"].map(k=>input[k]).join("|"));
  const response = await fetch(requiredEnv("VNPAY_API_URL"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("VNPay query unavailable");
  const data = await response.json() as Record<string,string>;
  if (!data || typeof data !== "object") throw new Error("VNPay QueryDR: phản hồi không đúng định dạng JSON.");
  // A bare gateway error has no authenticated transaction result. Report the
  // actual API error; never mislabel it as a failed payment or release stock.
  if (!data.vnp_SecureHash && data.vnp_ResponseCode !== "00") {
    const reasons: Record<string, string> = { "02": "TmnCode không hợp lệ hoặc chưa được cấp quyền QueryDR.", "03": "VNPay từ chối định dạng yêu cầu đối soát.", "91": "API báo chưa tìm thấy giao dịch nhưng chưa có chữ ký xác thực.", "94": "VNPay giới hạn truy vấn lặp; hệ thống sẽ chờ lượt tiếp theo.", "97": "VNPay từ chối checksum của yêu cầu; kiểm tra HashSecret đúng terminal.", "99": "API đối soát VNPay trả Unexpected error; chưa có kết quả giao dịch có chữ ký." };
    const code = /^\d{2}$/.test(String(data.vnp_ResponseCode)) ? String(data.vnp_ResponseCode) : "UNKNOWN";
    throw new Error(`VNPay QueryDR ${code}: ${reasons[code] || "API chưa trả kết quả có thể xác minh."}`);
  }
  if (!verifyQueryResponse(data) || data.vnp_TmnCode !== input.vnp_TmnCode || data.vnp_TxnRef !== p.reference || data.vnp_Command !== "querydr") throw new Error("Invalid VNPay query signature");
  await db.paymentAttempt.updateMany({ where: { id, status: "PENDING" }, data: { lastCheckedAt: new Date(), lastError: null } });
  // A signed "not found" can close an abandoned payment only after its entire
  // validity period plus a 5-minute notification grace period. Late money is REVIEW.
  if (data.vnp_ResponseCode === "91" && now.getTime() > p.expiresAt.getTime() + 5 * 60_000) {
    await settle({ ...data, vnp_Amount: String(p.amount * 100), vnp_TransactionStatus: "02" }, true);
    return;
  }
  // Throttling, unsigned errors and processing/reversal/fraud results keep the hold.
  if (data.vnp_ResponseCode !== "00") return;
  await settle(data, data.vnp_TransactionStatus === "02");
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("VNPay QueryDR") ? error.message : error instanceof Error && error.message === "Invalid VNPay query signature" ? "VNPay QueryDR: chữ ký hoặc thông tin giao dịch không khớp; chưa xác nhận thanh toán." : "VNPay QueryDR: lỗi kết nối hoặc phản hồi chưa hợp lệ; sẽ thử lại sau.";
    await db.paymentAttempt.updateMany({ where: { id, status: "PENDING" }, data: { lastCheckedAt: new Date(), lastError: message } });
    throw new Error(message);
  }
}

export async function reconcilePayments() {
  const jobs = await getPrisma().paymentAttempt.findMany({ where: { status: "PENDING", nextCheckAt: { lte: new Date() } }, take: 10, orderBy: { nextCheckAt: "asc" } });
  for (const p of jobs) try { await reconcilePayment(p.id); } catch (error) { console.warn(error instanceof Error ? error.message : "VNPay QueryDR chưa sẵn sàng.", `PaymentAttempt=${p.id}. Trạng thái đơn chưa thay đổi.`); }
}
