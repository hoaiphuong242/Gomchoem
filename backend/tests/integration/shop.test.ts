import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../src/lib/prisma";
import {
  transaction,
  expireReservations,
} from "../../src/repositories/shop.repo";
import * as shop from "../../src/services/shop.service";
import {
  statusSchema,
  posSchema,
  checkoutSchema,
} from "../../src/schemas/shop.schema";
import { invoicePdf } from "../../src/services/invoice.service";

const db = getPrisma();
after(async () => db.$disconnect());
async function user(role: "USER" | "ADMIN" | "CASHIER" | "WAREHOUSE" = "USER") {
  const u = await db.user.create({
    data: {
      name: "Khách kiểm thử",
      email: `${randomUUID()}@test.invalid`,
      passwordHash: "not-a-password",
      role,
    },
  });
  const { passwordHash: _passwordHash, ...actor } = u;
  return actor;
}
async function product(stock = 1, price = 100000) {
  const key = randomUUID();
  const category = await db.category.create({ data: { name: key, slug: key } });
  return db.product.create({
    data: {
      name: "Bát kiểm thử",
      sku: key,
      slug: key,
      categoryId: category.id,
      description: "test",
      price,
      inventory: { create: { onHand: stock } },
      images: { create: { url: "https://example.com/image.jpg" } },
    },
  });
}
const checkout = (paymentMethod: "TRANSFER" | "COD", extra = {}) =>
  checkoutSchema.parse({
    recipientName: "Nguyễn An",
    phone: "0905123456",
    address: "12 đường thử nghiệm",
    city: "Đà Nẵng",
    paymentMethod,
    ...extra,
  });
const action = (value: string, extra = {}) =>
  statusSchema.parse({ action: value, ...extra });

test("retrying same cart keeps deadline; replacing cart releases the previous items", async () => {
  const [a, p, q] = await Promise.all([user(), product(), product()]);
  const first = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  const repeated = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  assert.equal(first.id, repeated.id);
  assert.equal(first.expiresAt?.getTime(), repeated.expiresAt?.getTime());
  const changed = await shop.reserve(a, [{ productId: q.id, quantity: 1 }]);
  assert.notEqual(first.id, changed.id);
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: p.id } }))
      .reserved,
    0,
  );
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: q.id } }))
      .reserved,
    1,
  );
});

test("cancelled shipped COD does not restock until physical return and cannot refund unpaid money", async () => {
  const [a, owner, p] = await Promise.all([user(), user("ADMIN"), product()]);
  const order = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  await shop.submitOrder(a, order.id, checkout("COD"));
  for (const step of ["PACK", "SHIP", "CANCEL"])
    await shop.changeOrder(owner, order.id, action(step));
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: p.id } }))
      .onHand,
    0,
  );
  const r = await shop.requestReturn(
    owner,
    order.id,
    "Shipper hoàn hàng chưa giao",
    "https://example.com/evidence",
  );
  await shop.reviewReturn(owner, r.id, {
    action: "APPROVE",
    restock: false,
    refund: 0,
    note: "Duyệt",
  });
  await assert.rejects(
    shop.reviewReturn(owner, r.id, {
      action: "RECEIVE",
      restock: true,
      refund: 1000,
      note: "Không được hoàn tiền chưa thu",
    }),
  );
  await shop.reviewReturn(owner, r.id, {
    action: "RECEIVE",
    restock: true,
    refund: 0,
    note: "Nhận lại nguyên vẹn",
  });
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: p.id } }))
      .onHand,
    1,
  );
});

test("two buyers race for the last item: exactly one reservation succeeds", async () => {
  const [a, b, p] = await Promise.all([user(), user(), product()]);
  const results = await Promise.allSettled([
    shop.reserve(a, [{ productId: p.id, quantity: 1 }]),
    shop.reserve(b, [{ productId: p.id, quantity: 1 }]),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const stock = await db.inventory.findUniqueOrThrow({
    where: { productId: p.id },
  });
  assert.equal(stock.onHand, 1);
  assert.equal(stock.reserved, 1);
});
test("expired reservations release exactly once and customer may reserve again", async () => {
  const [a, p] = await Promise.all([user(), product()]);
  const o = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  await db.order.update({
    where: { id: o.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await transaction(expireReservations);
  await transaction(expireReservations);
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: p.id } }))
      .reserved,
    0,
  );
  await assert.rejects(shop.submitOrder(a, o.id, checkout("COD")));
  const next = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  assert.notEqual(next.id, o.id);
});
test("whole cart rolls back if one item is unavailable", async () => {
  const [a, p, sold] = await Promise.all([user(), product(), product(0)]);
  await assert.rejects(
    shop.reserve(a, [
      { productId: p.id, quantity: 1 },
      { productId: sold.id, quantity: 1 },
    ]),
  );
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: p.id } }))
      .reserved,
    0,
  );
});
test("manual transfer stays held, submission is idempotent, owner confirms and return restocks once", async () => {
  const [a, owner, p] = await Promise.all([user(), user("ADMIN"), product()]);
  const o = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  const input = checkout("TRANSFER", { pickup: true });
  const [first, retry] = await Promise.all([
    shop.submitOrder(a, o.id, input),
    shop.submitOrder(a, o.id, input),
  ]);
  assert.equal(first.id, retry.id);
  assert.equal(first.status, "PENDING_PAYMENT");
  assert.equal(first.expiresAt, null);
  await transaction(expireReservations);
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: p.id } }))
      .reserved,
    1,
  );
  await assert.rejects(shop.changeOrder(a, o.id, action("CONFIRM_PAYMENT")));
  await shop.changeOrder(owner, o.id, action("CONFIRM_PAYMENT"));
  await shop.changeOrder(owner, o.id, action("DELIVER"));
  let stock = await db.inventory.findUniqueOrThrow({
    where: { productId: p.id },
  });
  assert.equal(stock.onHand, 0);
  assert.equal(stock.reserved, 0);
  const r = await shop.requestReturn(
    a,
    o.id,
    "Đổi trả trong hạn",
    "https://example.com/video.mp4",
  );
  await shop.reviewReturn(owner, r.id, {
    action: "APPROVE",
    restock: false,
    refund: 0,
    note: "Duyệt tiếp nhận",
  });
  await shop.reviewReturn(owner, r.id, {
    action: "RECEIVE",
    restock: true,
    refund: first.total,
    note: "Đã nhận nguyên vẹn và đã hoàn tiền thực tế",
  });
  await assert.rejects(
    shop.reviewReturn(owner, r.id, {
      action: "RECEIVE",
      restock: true,
      refund: first.total,
      note: "Lặp",
    }),
  );
  stock = await db.inventory.findUniqueOrThrow({ where: { productId: p.id } });
  assert.equal(stock.onHand, 1);
  assert.equal(stock.reserved, 0);
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus,
    "REFUNDED",
  );
});
test("COD submission, shipping, delivery and 48 hour window", async () => {
  const [a, owner, p] = await Promise.all([user(), user("ADMIN"), product()]);
  const o = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  const submitted = await shop.submitOrder(a, o.id, checkout("COD"));
  assert.equal(submitted.total, 120000);
  assert.equal(submitted.status, "CONFIRMED");
  await shop.changeOrder(owner, o.id, action("PACK"));
  await shop.changeOrder(
    owner,
    o.id,
    action("SHIP", { trackingCode: "TEST-001" }),
  );
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: p.id } }))
      .onHand,
    0,
  );
  await shop.changeOrder(owner, o.id, action("DELIVER"));
  await db.order.update({
    where: { id: o.id },
    data: { deliveredAt: new Date(Date.now() - 49 * 3600000) },
  });
  await assert.rejects(
    shop.requestReturn(a, o.id, "Quá hạn", "https://example.com/video"),
  );
});
test("cancel before shipment releases stock; owner must record refunds for paid orders", async () => {
  const [a, owner, p] = await Promise.all([user(), user("ADMIN"), product()]);
  const o = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  await shop.submitOrder(a, o.id, checkout("TRANSFER"));
  await shop.changeOrder(owner, o.id, action("CONFIRM_PAYMENT"));
  await assert.rejects(shop.changeOrder(a, o.id, action("CANCEL")));
  await assert.rejects(shop.changeOrder(owner, o.id, action("CANCEL")));
  await shop.changeOrder(
    owner,
    o.id,
    action("CANCEL", {
      refundConfirmed: true,
      refundAmount: 120000,
      note: "Đã đối soát hoàn tiền",
    }),
  );
  const stock = await db.inventory.findUniqueOrThrow({
    where: { productId: p.id },
  });
  assert.equal(stock.onHand, 1);
  assert.equal(stock.reserved, 0);
});
test("POS request retry does not sell twice; cashier cannot edit stock, warehouse cannot take payments", async () => {
  const [cashier, warehouse, p] = await Promise.all([
    user("CASHIER"),
    user("WAREHOUSE"),
    product(2),
  ]);
  const body = posSchema.parse({
    requestKey: randomUUID(),
    items: [{ productId: p.id, quantity: 1 }],
    name: "Khách tại quầy",
    channel: "STORE",
    paymentMethod: "CASH",
  });
  const [a, b] = await Promise.all([
    shop.posOrder(cashier, body),
    shop.posOrder(cashier, body),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: p.id } }))
      .onHand,
    1,
  );
  await assert.rejects(
    shop.posOrder(warehouse, { ...body, requestKey: randomUUID() }),
  );
  await assert.rejects(
    shop.adjustStock(cashier, {
      productId: p.id,
      quantity: 1,
      note: "test",
      type: "IMPORT",
    }),
  );
  const pdf = await invoicePdf(await shop.getOrder(cashier, a.id));
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 5000);
});
test("voucher capacity cannot be overspent by concurrent orders", async () => {
  const [a, b, p] = await Promise.all([user(), user(), product(2)]);
  const voucher = await db.voucher.create({
    data: { code: randomUUID(), amount: 20000, maxUses: 1 },
  });
  const oa = await shop.reserve(a, [{ productId: p.id, quantity: 1 }]);
  const ob = await shop.reserve(b, [{ productId: p.id, quantity: 1 }]);
  const input = checkout("COD", { voucherCode: voucher.code });
  // checkout normalizes case; use the same normalized value in database.
  await db.voucher.update({
    where: { code: voucher.code },
    data: { code: input.voucherCode },
  });
  const result = await Promise.allSettled([
    shop.submitOrder(a, oa.id, input),
    shop.submitOrder(b, ob.id, input),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.voucher.findUniqueOrThrow({ where: { code: input.voucherCode } }))
      .used,
    1,
  );
});
