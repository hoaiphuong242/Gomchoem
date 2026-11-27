import { createHmac, timingSafeEqual } from "node:crypto";
import { requiredEnv } from "@/lib/integrations";

export function vnpDate(date: Date) {
  return new Date(date.getTime() + 7 * 3600_000).toISOString().replace(/[-:T]/g, "").slice(0, 14);
}
export const hmac = (data: string, secret = requiredEnv("VNPAY_HASH_SECRET")) => createHmac("sha512", secret).update(data, "utf8").digest("hex");
const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");
export function canonical(params: Record<string, string>) {
  return Object.keys(params).sort().map(key => `${encode(key)}=${encode(params[key])}`).join("&");
}
export function equalSignature(actual: string, expected: string) {
  return /^[a-f0-9]{128}$/i.test(actual) && timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
export function verifyQueryResponse(data: Record<string, string>) {
  const keys = ["vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo"];
  const base = keys.map(key => data[key] ?? "").join("|");
  const current = `${base}|${data.vnp_PromotionCode ?? ""}|${data.vnp_PromotionAmount ?? ""}`;
  if (equalSignature(data.vnp_SecureHash ?? "", hmac(current))) return true;
  // Earlier 2.1.0 terminals sign the documented 13-field response. Never
  // accept that variant when promotion fields are present but unsigned.
  return !("vnp_PromotionCode" in data) && !("vnp_PromotionAmount" in data) && equalSignature(data.vnp_SecureHash ?? "", hmac(base));
}
export function verifyCallback(params: URLSearchParams) {
  const fields: Record<string, string> = {};
  for (const [key, value] of params) {
    if (!key.startsWith("vnp_")) return null;
    if (params.getAll(key).length !== 1) return null;
    if (key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") fields[key] = value;
  }
  if (!equalSignature(params.get("vnp_SecureHash") ?? "", hmac(canonical(fields)))) return null;
  if (fields.vnp_TmnCode !== requiredEnv("VNPAY_TMN_CODE")) return null;
  return fields;
}
export function paymentUrl(payment: {reference: string; amount: number; createdAt: Date; expiresAt: Date}, ip: string) {
  const fields = {
    vnp_Version: "2.1.0", vnp_Command: "pay", vnp_TmnCode: requiredEnv("VNPAY_TMN_CODE"),
    vnp_Amount: String(payment.amount * 100), vnp_CurrCode: "VND", vnp_TxnRef: payment.reference,
    vnp_OrderInfo: `Thanh toan don hang ${payment.reference}`, vnp_OrderType: "other",
    vnp_Locale: "vn", vnp_ReturnUrl: requiredEnv("VNPAY_RETURN_URL"), vnp_IpAddr: ip,
    vnp_CreateDate: vnpDate(payment.createdAt), vnp_ExpireDate: vnpDate(payment.expiresAt),
  };
  const query = canonical(fields);
  return `${requiredEnv("VNPAY_PAYMENT_URL")}?${query}&vnp_SecureHash=${hmac(query)}`;
}
