import assert from "node:assert/strict";
import { test } from "node:test";
import { canonical, hmac, paymentUrl, verifyCallback, verifyQueryResponse, vnpDate } from "../src/lib/vnpay";

process.env.VNPAY_TMN_CODE = "TESTCODE";
process.env.VNPAY_HASH_SECRET = "unit-test-secret";
process.env.VNPAY_RETURN_URL = "http://localhost:5173/thanh-toan/vnpay/ket-qua";
process.env.VNPAY_PAYMENT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

test("VNPay sorts and encodes the exact signing payload, uses GMT+7 and multiplies VND by 100", () => {
  assert.equal(canonical({ z: "hai từ", a: "A&B" }), "a=A%26B&z=hai+t%E1%BB%AB");
  assert.equal(vnpDate(new Date("2026-11-21T18:00:00Z")), "20261122010000");
  const url = new URL(paymentUrl({ reference: "abc", amount: 120000, createdAt: new Date("2026-11-22T00:00:00Z"), expiresAt: new Date("2026-11-22T00:15:00Z") }, "127.0.0.1"));
  assert.equal(url.searchParams.get("vnp_Amount"), "12000000");
  assert.equal(url.searchParams.get("vnp_CreateDate"), "20261122070000");
  assert.ok(verifyCallback(url.searchParams));
  url.searchParams.set("vnp_Amount", "1");
  assert.equal(verifyCallback(url.searchParams), null);
});
test("VNPay rejects duplicate parameters, wrong merchants and malformed hashes", () => {
  const fields = { vnp_TmnCode: "OTHER", vnp_TxnRef: "abc" };
  const params = new URLSearchParams({ ...fields, vnp_SecureHash: hmac(canonical(fields)) });
  assert.equal(verifyCallback(params), null);
  params.set("vnp_TmnCode", "TESTCODE");
  params.set("vnp_SecureHash", "0");
  assert.equal(verifyCallback(params), null);
  params.append("vnp_TxnRef", "abc");
  assert.equal(verifyCallback(params), null);
});

test("QueryDR verifies promotion fields including empty trailing fields, rejects unsigned promotions", () => {
  const response: Record<string, string> = { vnp_ResponseId: "r", vnp_Command: "querydr", vnp_ResponseCode: "00", vnp_Message: "OK", vnp_TmnCode: "TESTCODE", vnp_TxnRef: "ref", vnp_Amount: "10000", vnp_BankCode: "NCB", vnp_PayDate: "20261122010000", vnp_TransactionNo: "123", vnp_TransactionType: "01", vnp_TransactionStatus: "00", vnp_OrderInfo: "order" };
  const legacy = Object.values(response).join("|");
  response.vnp_SecureHash = hmac(legacy);
  assert.equal(verifyQueryResponse(response), true);
  response.vnp_PromotionCode = ""; response.vnp_PromotionAmount = "";
  assert.equal(verifyQueryResponse(response), false);
  response.vnp_SecureHash = hmac(legacy + "||");
  assert.equal(verifyQueryResponse(response), true);
  response.vnp_PromotionAmount = "100";
  assert.equal(verifyQueryResponse(response), false);
});
