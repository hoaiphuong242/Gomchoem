import assert from "node:assert/strict";
import { after, test, mock } from "node:test";
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { getPrisma } from "../../src/lib/prisma";
import { canonical, hmac } from "../../src/lib/vnpay";
import { checkoutSchema } from "../../src/schemas/shop.schema";
import { reserve, submitOrder, changeOrder } from "../../src/services/shop.service";
import { receiveIpn, returnResult, reconcilePayment, checkoutPayment } from "../../src/services/payment.service";
import { buildOrderEmail, processEmails } from "../../src/services/email.service";
import { upload } from "../../src/services/media.service";

process.env.VNPAY_TMN_CODE = "TESTCODE";
process.env.VNPAY_HASH_SECRET = "integration-secret";
process.env.VNPAY_RETURN_URL = "http://localhost:5173/thanh-toan/vnpay/ket-qua";
process.env.VNPAY_PAYMENT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
process.env.VNPAY_API_URL = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
process.env.APP_FRONTEND_URL = "http://localhost:5173";
process.env.SENDGRID_FROM_EMAIL = "shop@test.invalid";
process.env.SENDGRID_API_KEY = "test-only-key";
process.env.SENDGRID_ORDER_TEMPLATE_ID = "";
process.env.SENDGRID_LOGO_URL = "";
const db = getPrisma();
after(async () => { mock.restoreAll(); await db.$disconnect(); });

async function fixture(method: "VNPAY" | "COD" | "TRANSFER" = "VNPAY", voucherCode = "") {
  const key = randomUUID();
  const user = await db.user.create({ data: { email: `${key}@test.invalid`, passwordHash: "unused", name: "Khách thử" } });
  const category = await db.category.create({ data: { name: key, slug: key } });
  const product = await db.product.create({ data: { name: "Bát thử", sku: key, slug: key, categoryId: category.id, price: 100000, description: "test", images: { create: { url: "https://example.com/test.jpg" } }, inventory: { create: { onHand: 1 } } } });
  const reservation = await reserve(user, [{ productId: product.id, quantity: 1 }]);
  const order = await submitOrder(user, reservation.id, checkoutSchema.parse({ recipientName: "Nguyễn An", phone: "0905123456", address: "12 đường thử", city: "Đà Nẵng", paymentMethod: method, voucherCode }));
  const payment = await db.paymentAttempt.findUnique({ where: { orderId: order.id } });
  return { user, product, order, payment: payment! };
}
function callback(reference: string, extra: Record<string,string> = {}) {
  const fields = { vnp_TmnCode: "TESTCODE", vnp_TxnRef: reference, vnp_Amount: "12000000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: String(Date.now()) + String(Math.floor(Math.random()*100)).padStart(2,"0"), ...extra };
  return new URLSearchParams({ ...fields, vnp_SecureHash: hmac(canonical(fields)) });
}

test("VNPay verifies signatures/amounts, protects ownership and handles concurrent IPN once", async () => {
  const f = await fixture();
  assert.equal(f.order.status, "PENDING_PAYMENT");
  assert.equal(await db.emailDelivery.count({ where: { orderId: f.order.id } }), 0);
  const bad = callback(f.payment.reference); bad.set("vnp_Amount", "1");
  assert.equal((await receiveIpn(bad)).RspCode, "97");
  assert.equal((await receiveIpn(callback(f.payment.reference, { vnp_Amount: "100" }))).RspCode, "04");
  await assert.rejects(checkoutPayment({ ...f.user, id: randomUUID() }, f.order.id, new Request("http://localhost")));
  const pay = await checkoutPayment(f.user, f.order.id, new Request("http://localhost"));
  assert.equal(new URL(pay.url).searchParams.get("vnp_Amount"), "12000000");
  const cb = callback(f.payment.reference);
  const responses = await Promise.all([receiveIpn(cb), receiveIpn(cb)]);
  assert.deepEqual(responses.map(r=>r.RspCode).sort(), ["00","02"]);
  const order = await db.order.findUniqueOrThrow({ where: { id: f.order.id } });
  assert.equal(order.status, "CONFIRMED"); assert.equal(order.paymentStatus, "PAID");
  assert.equal(await db.emailDelivery.count({ where: { orderId: order.id } }), 1);
  assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: f.product.id } })).reserved, 1);
  const email = await buildOrderEmail(order.id);
  assert.ok(email?.attachments[0].content.startsWith("JVBER"));
  assert.equal(email?.attachments[1].content_id, "gomchoem-logo");
  assert.match(email!.subject, /xác nhận thanh toán/);
});

test("failed VNPay releases stock/voucher once; late success is flagged without reclaiming inventory", async () => {
  const voucherCode = ("TEST" + randomUUID().slice(0,8)).toUpperCase();
  await db.voucher.create({ data: { code: voucherCode, amount: 10000 } });
  const f = await fixture("VNPAY", voucherCode);
  const failed = callback(f.payment.reference, { vnp_Amount: "11000000", vnp_ResponseCode: "24", vnp_TransactionStatus: "02" });
  await receiveIpn(failed); await receiveIpn(failed);
  assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: f.product.id } })).reserved, 0);
  assert.equal((await db.voucher.findUniqueOrThrow({ where: { code: voucherCode } })).used, 0);
  await receiveIpn(callback(f.payment.reference, { vnp_Amount: "11000000" }));
  assert.equal((await db.paymentAttempt.findUniqueOrThrow({ where: { id: f.payment.id } })).status, "REVIEW");
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, "EXPIRED");
  assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: f.product.id } })).reserved, 0);
});

test("signed successful return confirms immediately, enqueues one email and is idempotent with IPN", async () => {
  const f = await fixture();
  const cb = callback(f.payment.reference);
  const first = await returnResult(f.user, cb);
  assert.equal(first.status, "PAID");
  assert.equal(first.paymentStatus, "PAID");
  await returnResult(f.user, cb);
  assert.equal((await receiveIpn(cb)).RspCode, "02");
  assert.equal(await db.emailDelivery.count({ where: { orderId: f.order.id } }), 1);
  assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: f.product.id } })).reserved, 1);
});

test("return rejects forged success, wrong amounts and other users; pending QueryDR cannot release stock without a valid signature", async () => {
  const f = await fixture();
  const cb = callback(f.payment.reference); cb.set("vnp_ResponseCode", "99");
  await assert.rejects(returnResult(f.user, cb));
  await assert.rejects(returnResult(f.user, callback(f.payment.reference, { vnp_Amount: "1" })));
  await assert.rejects(returnResult({ ...f.user, id: randomUUID() }, callback(f.payment.reference)));
  const result = await returnResult(f.user, callback(f.payment.reference, { vnp_ResponseCode: "24", vnp_TransactionStatus: "01" }));
  assert.equal(result.status, "PENDING");
  await assert.rejects(changeOrder(f.user, f.order.id, { action: "CANCEL", note: "", trackingCode: "", refundConfirmed: false, refundAmount: 0 }));
  await db.paymentAttempt.update({ where: { id: f.payment.id }, data: { nextCheckAt: new Date(0), expiresAt: new Date(0) } });
  const network = mock.method(globalThis, "fetch", async () => Response.json({ vnp_ResponseCode: "00", vnp_TransactionStatus: "02", vnp_TxnRef: f.payment.reference, vnp_SecureHash: "invalid" }));
  try { await assert.rejects(reconcilePayment(f.payment.id)); } finally { network.mock.restore(); }
  assert.equal((await db.paymentAttempt.findUniqueOrThrow({ where: { id: f.payment.id } })).status, "PENDING");
  assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: f.product.id } })).reserved, 1);
});

test("signed failed return releases abandoned payment without depending on QueryDR availability", async () => {
  const f = await fixture();
  const network = mock.method(globalThis, "fetch", async () => { throw new Error("Gateway unavailable"); });
  try {
    const result = await returnResult(f.user, callback(f.payment.reference, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }));
    assert.equal(result.status, "FAILED");
    assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: f.product.id } })).reserved, 0);
    assert.equal(network.mock.callCount(), 0);
  } finally { network.mock.restore(); }
});

test("VNPay unsigned API error 99 is recorded separately and never changes payment or inventory", async () => {
  const f = await fixture();
  await db.paymentAttempt.update({ where: { id: f.payment.id }, data: { nextCheckAt: new Date(0) } });
  const network = mock.method(globalThis, "fetch", async () => Response.json({ vnp_ResponseCode: "99", vnp_Message: "Unexpected error" }));
  try { await assert.rejects(reconcilePayment(f.payment.id), /VNPay QueryDR 99/); } finally { network.mock.restore(); }
  const payment = await db.paymentAttempt.findUniqueOrThrow({ where: { id: f.payment.id } });
  assert.equal(payment.status, "PENDING"); assert.match(payment.lastError!, /Unexpected error/); assert.ok(payment.lastCheckedAt);
  assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: f.product.id } })).reserved, 1);
  assert.equal(await db.emailDelivery.count({ where: { orderId: f.order.id } }), 0);
});

test("SendGrid retry does not change order status and accepted email is not sent a second time", async () => {
  const f = await fixture("COD");
  // Isolate the worker batch from earlier fixture outbox messages.
  await db.emailDelivery.updateMany({ where: { orderId: { not: f.order.id } }, data: { nextAttemptAt: new Date(Date.now()+3600_000) } });
  let requests = 0;
  const network = mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    requests++;
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.personalizations[0].to[0].email, f.user.email);
    assert.ok(payload.attachments[0].content.startsWith("JVBER"));
    return requests === 1 ? new Response("", { status: 503 }) : new Response(null, { status: 202, headers: { "x-message-id": "test-id" } });
  });
  try {
    await processEmails();
    const job = await db.emailDelivery.findFirstOrThrow({ where: { orderId: f.order.id } });
    assert.equal(job.status, "PENDING"); assert.equal(job.attempts, 1);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, "CONFIRMED");
    await db.emailDelivery.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
    await processEmails(); await processEmails();
    assert.equal(requests, 2);
    assert.equal((await db.emailDelivery.findUniqueOrThrow({ where: { id: job.id } })).status, "SENT");
  } finally { network.mock.restore(); }
});

test("QueryDR verifies response hash, settles paid results and closes abandoned expired transactions", async () => {
  const signedQuery = (reference: string, code: string, status: string) => {
    const data: Record<string,string> = { vnp_ResponseId: "query-test", vnp_Command: "querydr", vnp_ResponseCode: code, vnp_Message: "Test result", vnp_TmnCode: "TESTCODE", vnp_TxnRef: reference, vnp_Amount: "12000000", vnp_BankCode: "NCB", vnp_PayDate: "20261122080000", vnp_TransactionNo: String(Date.now()), vnp_TransactionType: "01", vnp_TransactionStatus: status, vnp_OrderInfo: "Test order", vnp_PromotionCode: "", vnp_PromotionAmount: "" };
    data.vnp_SecureHash = hmac(["vnp_ResponseId","vnp_Command","vnp_ResponseCode","vnp_Message","vnp_TmnCode","vnp_TxnRef","vnp_Amount","vnp_BankCode","vnp_PayDate","vnp_TransactionNo","vnp_TransactionType","vnp_TransactionStatus","vnp_OrderInfo","vnp_PromotionCode","vnp_PromotionAmount"].map(k=>data[k]).join("|"));
    return data;
  };
  for (const variant of ["paid", "expired"] as const) {
    const f = await fixture();
    await db.paymentAttempt.update({ where: { id: f.payment.id }, data: { nextCheckAt: new Date(0), ...(variant === "expired" ? { expiresAt: new Date(Date.now() - 10*60_000) } : {}) } });
    const network = mock.method(globalThis, "fetch", async () => Response.json(signedQuery(f.payment.reference, variant === "paid" ? "00" : "91", variant === "paid" ? "00" : "")));
    try { await reconcilePayment(f.payment.id); } finally { network.mock.restore(); }
    assert.equal((await db.paymentAttempt.findUniqueOrThrow({ where: { id: f.payment.id } })).status, variant === "paid" ? "PAID" : "FAILED");
    assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: f.product.id } })).reserved, variant === "paid" ? 1 : 0);
  }
});

test("SendGrid 403 stops automatic retries with a safe sender error and preserves confirmed order", async () => {
  const f = await fixture("COD");
  await db.emailDelivery.updateMany({ where: { orderId: { not: f.order.id } }, data: { nextAttemptAt: new Date(Date.now() + 3600_000) } });
  const network = mock.method(globalThis, "fetch", async () => Response.json({ errors: [{ message: "The from address private@example.com does not match a verified Sender Identity." }] }, { status: 403 }));
  try {
    await processEmails(); await processEmails();
    const job = await db.emailDelivery.findFirstOrThrow({ where: { orderId: f.order.id } });
    assert.equal(job.status, "FAILED"); assert.equal(network.mock.callCount(), 1);
    assert.match(job.lastError!, /SENDGRID_FROM_EMAIL/); assert.ok(!job.lastError!.includes("private@example.com"));
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, "CONFIRMED");
  } finally { network.mock.restore(); }
});

test("Cloudinary streams validated images and videos with distinct resource types", async () => {
  process.env.CLOUDINARY_CLOUD_NAME = "test"; process.env.CLOUDINARY_API_KEY = "test"; process.env.CLOUDINARY_API_SECRET = "test";
  const resources: string[] = [];
  const mocked = mock.method(cloudinary.uploader, "upload_stream", (options: { resource_type: string }, callback: (error: null, result: { secure_url: string }) => void) => {
    resources.push(options.resource_type);
    return new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { callback(null, { secure_url: `https://res.cloudinary.com/test/${options.resource_type}/upload/test` }); done(); } });
  });
  try {
    const jpg = new File([new Uint8Array([255,216,255,0])], "test.jpg", { type: "image/jpeg" });
    const mp4 = new File([new Uint8Array([0,0,0,12,102,116,121,112,105,115,111,109])], "test.mp4", { type: "video/mp4" });
    assert.ok((await upload(jpg)).url.startsWith("https://res.cloudinary.com/"));
    await upload(mp4); assert.deepEqual(resources, ["image","video"]);
    await assert.rejects(upload(new File(["<script>"], "fake.jpg", { type: "image/jpeg" })));
  } finally { mocked.mock.restore(); }
});
