import assert from "node:assert/strict";
import { after, test } from "node:test";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { getPrisma } from "../../src/lib/prisma";
import { notifications, readNotifications, registerPushToken, removePushToken, processPushNotifications } from "../../src/services/notification.service";
import type { Message } from "firebase-admin/messaging";

const db = getPrisma();
after(() => db.$disconnect());
async function user(role: "USER" | "ADMIN" | "CASHIER" | "WAREHOUSE" = "USER") {
  return db.user.create({ data: { name: "Notification test", email: `${randomUUID()}@test.invalid`, passwordHash: "test-only", role } });
}
test("transactional order/inquiry/return events respect role, ownership, rollback and read counts", async () => {
  const [customer, other, admin, cashier, warehouse] = await Promise.all([user(), user(), user("ADMIN"), user("CASHIER"), user("WAREHOUSE")]);
  const order = await db.order.create({ data: { code: randomUUID(), customerId: customer.id, total: 100000, subtotal: 100000 } });
  assert.equal(await db.notification.count({ where: { userId: customer.id } }), 0, "a cart reservation is not an order notification");
  await assert.rejects(db.$transaction(async tx => {
    await tx.order.update({ where: { id: order.id }, data: { submittedAt: new Date(), status: "CONFIRMED" } });
    throw new Error("rollback");
  }));
  assert.equal(await db.notification.count({ where: { userId: customer.id } }), 0);
  await db.order.update({ where: { id: order.id }, data: { submittedAt: new Date(), status: "CONFIRMED" } });
  const initial = await notifications(customer);
  assert.equal(initial.unread, 1);
  assert.equal(initial.items[0].url, `/don-hang/${order.id}`);
  await db.order.update({ where: { id: order.id }, data: { note: "No status change" } });
  assert.equal((await notifications(customer)).unread, 1);
  assert.equal((await notifications(other)).unread, 0);
  assert.equal((await readNotifications(other, initial.items[0].id)).updated, 0);
  assert.equal((await notifications(customer)).unread, 1);
  await readNotifications(customer, initial.items[0].id);
  assert.equal((await notifications(customer)).unread, 0);
  const beforeCounts = (await notifications(admin)).counts;
  const inquiry = await db.inquiry.create({ data: { name: "Tester", phone: "0905123456", topic: "test", message: "test" } });
  const returned = await db.returnRequest.create({ data: { orderId: order.id, userId: admin.id, reason: "test", evidence: "test" } });
  assert.equal((await notifications(admin)).counts.inquiries, beforeCounts.inquiries + 1);
  assert.equal((await notifications(admin)).counts.returns, beforeCounts.returns + 1);
  assert.equal((await notifications(cashier)).items.filter(item => item.scope === "INQUIRIES").length, 1);
  assert.equal((await notifications(cashier)).counts.returns, 0);
  assert.equal((await notifications(warehouse)).items.some(item => ["INQUIRIES", "RETURNS"].includes(item.scope)), false);
  assert.equal((await notifications(customer)).unread, 1, "return created by staff must notify the order customer");
  await db.inquiry.update({ where: { id: inquiry.id }, data: { resolved: true } });
  await db.returnRequest.update({ where: { id: returned.id }, data: { status: "RECEIVED" } });
  assert.equal((await notifications(admin)).counts.inquiries, beforeCounts.inquiries);
  assert.equal((await notifications(admin)).counts.returns, beforeCounts.returns);
  await db.user.update({ where: { id: admin.id }, data: { role: "USER" } });
  assert.equal((await notifications({ ...admin, role: "USER" })).items.some(item => item.scope !== "CUSTOMER"), false);
});

test("order messages describe the actual event even when an already-paid order changes delivery status", async () => {
  const customer = await user();
  const order = await db.order.create({ data: { code: randomUUID(), customerId: customer.id, total: 100, subtotal: 100, submittedAt: new Date(), status: "CONFIRMED", paymentStatus: "PAID" } });
  const seen = new Set<string>();
  async function expectEvent(title: string) {
    const items = (await notifications(customer)).items.filter(item => !seen.has(item.id));
    assert.equal(items.length, 1);
    assert.equal(items[0].title, title);
    seen.add(items[0].id);
  }
  await expectEvent("Gốm Cho Em đã tiếp nhận đơn hàng");
  const steps = [
    ["PACKING", "Gốm Cho Em đã đóng gói đơn hàng"],
    ["SHIPPED", "Gốm Cho Em đã bàn giao đơn cho vận chuyển"],
    ["DELIVERED", "Đơn hàng Gốm Cho Em đã giao thành công"],
  ] as const;
  for (const [status, title] of steps) {
    await db.order.update({ where: { id: order.id }, data: { status } });
    await expectEvent(title);
  }
  await db.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED" } });
  await expectEvent("Gốm Cho Em đã ghi nhận hoàn tiền");
  const returned = await db.returnRequest.create({ data: { orderId: order.id, userId: customer.id, reason: "test", evidence: "test" } });
  await expectEvent("Gốm Cho Em đã tiếp nhận yêu cầu đổi trả");
  for (const [status, title] of [["APPROVED", "Gốm Cho Em đã duyệt yêu cầu đổi trả"], ["RECEIVED", "Gốm Cho Em đã nhận lại hàng đổi trả"]]) {
    await db.returnRequest.update({ where: { id: returned.id }, data: { status } });
    await expectEvent(title);
  }
});

test("FCM outbox retries, skips read events, removes expired tokens, and prevents delivery after account rebind", async () => {
  process.env.FIREBASE_PROJECT_ID ||= "test-project";
  process.env.FIREBASE_CLIENT_EMAIL ||= "test@test-project.iam.gserviceaccount.com";
  process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const [customer, other] = await Promise.all([user(), user()]);
  const token = `test-token-${randomUUID()}`;
  await registerPushToken(customer, token);
  const device = await db.pushToken.findUniqueOrThrow({ where: { token } });
  const order = await db.order.create({ data: { code: randomUUID(), customerId: customer.id, total: 100, subtotal: 100, submittedAt: new Date(), status: "CONFIRMED" } });
  const job = await db.pushDelivery.findFirstOrThrow({ where: { tokenId: device.id } });
  const sent: Message[] = [];
  await processPushNotifications(async message => { sent.push(message); return "test-message"; });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].data?.userId, customer.id);
  assert.equal(sent[0].data?.title, "Gốm Cho Em đã tiếp nhận đơn hàng");
  assert.ok(sent[0].data?.body.includes(order.code));
  const notice = await db.notification.findUniqueOrThrow({ where: { id: job.notificationId } });
  assert.equal(sent[0].data?.body, notice.body, "push must match the saved event");
  assert.equal((await db.pushDelivery.findUniqueOrThrow({ where: { id: job.id } })).status, "SENT");
  await processPushNotifications(async () => { throw new Error("SENT jobs must not run twice"); });
  await db.order.update({ where: { id: order.id }, data: { status: "PACKING" } });
  const retry = await db.pushDelivery.findFirstOrThrow({ where: { tokenId: device.id, status: "PENDING" } });
  await processPushNotifications(async () => { throw Object.assign(new Error("transient"), { code: "messaging/server-unavailable" }); });
  const deferred = await db.pushDelivery.findUniqueOrThrow({ where: { id: retry.id } });
  assert.equal(deferred.status, "PENDING");
  assert.equal(deferred.attempts, 1);
  assert.ok(deferred.nextAttemptAt.getTime() > Date.now());
  await readNotifications(customer);
  await db.pushDelivery.update({ where: { id: retry.id }, data: { nextAttemptAt: new Date(0) } });
  await processPushNotifications(async () => { throw new Error("Read jobs must be skipped"); });
  assert.equal((await db.pushDelivery.findUniqueOrThrow({ where: { id: retry.id } })).status, "SKIPPED");
  await db.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
  await registerPushToken(other, token);
  assert.equal(await db.pushDelivery.count({ where: { tokenId: device.id } }), 0);
  await removePushToken(customer, token);
  assert.equal((await db.pushToken.findUniqueOrThrow({ where: { token } })).userId, other.id);
  await db.order.create({ data: { code: randomUUID(), customerId: other.id, total: 100, subtotal: 100, submittedAt: new Date(), status: "CONFIRMED" } });
  await processPushNotifications(async () => { throw Object.assign(new Error("expired"), { code: "messaging/registration-token-not-registered" }); });
  assert.equal(await db.pushToken.count({ where: { token } }), 0);
  assert.equal(await db.pushDelivery.count({ where: { tokenId: device.id } }), 0);
});
