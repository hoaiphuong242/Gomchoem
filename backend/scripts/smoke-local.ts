import { config } from "dotenv";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "../src/lib/prisma";

config({ quiet: true });
config({ path: ".env.local", override: true, quiet: true });
const db = getPrisma();
const base = process.env.QA_API_URL ?? "http://127.0.0.1:5173/api";
const key = randomUUID();
const email = `smoke-${key}@example.test`;
let userId: string | undefined,
  productId: string | undefined,
  categoryId: string | undefined,
  uploaded: string | undefined;
async function api(
  route: string,
  method = "GET",
  body?: unknown,
  token?: string,
  expected = 200,
) {
  const response = await fetch(base + route, {
    method,
    headers: {
      Origin: "http://127.0.0.1:5173",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${route}: ${JSON.stringify(result)}`,
  );
  return result.data;
}
async function main() {
  try {
    const owner = await api("/auth/login", "POST", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    const created = await api(
      "/auth/register",
      "POST",
      { email, name: "Khách smoke test local", password: `test-${key}` },
      undefined,
      201,
    );
    userId = created.id;
    const customer = await api("/auth/login", "POST", {
      email,
      password: `test-${key}`,
    });
    const category = await db.category.create({
      data: { name: `QA-${key}`, slug: key },
    });
    categoryId = category.id;
    const product = await db.product.create({
      data: {
        name: "Sản phẩm kiểm thử API",
        sku: key,
        slug: key,
        description: "Không phải hàng bán",
        price: 100000,
        categoryId,
        inventory: { create: { onHand: 1 } },
        images: { create: { url: "https://example.com/test.jpg" } },
      },
    });
    productId = product.id;
    await api("/shop/products");
    await api("/shop/settings");
    await api("/shop/admin/dashboard", "GET", undefined, undefined, 401);
    await api(
      "/shop/admin/dashboard",
      "GET",
      undefined,
      customer.accessToken,
      403,
    );
    const o = await api(
      "/shop/reservations",
      "POST",
      { items: [{ productId, quantity: 1 }] },
      customer.accessToken,
      201,
    );
    const checkout = {
      recipientName: "Khách kiểm thử API",
      phone: "0900000000",
      address: "Địa chỉ kiểm thử, không giao hàng",
      city: "Đà Nẵng",
      paymentMethod: "COD",
    };
    await api(
      `/shop/orders/${o.id}/submit`,
      "POST",
      { ...checkout, total: 1 },
      customer.accessToken,
      422,
    );
    const quote = await api(
      `/shop/orders/${o.id}/quote`,
      "POST",
      checkout,
      customer.accessToken,
    );
    assert.equal(quote.total, 120000);
    await api(
      `/shop/orders/${o.id}/submit`,
      "POST",
      checkout,
      customer.accessToken,
    );
    for (const action of ["PACK", "SHIP", "DELIVER"])
      await api(
        `/shop/admin/orders/${o.id}`,
        "PUT",
        { action, trackingCode: "QA-LOCAL" },
        owner.accessToken,
      );
    const invoice = await fetch(`${base}/shop/orders/${o.id}/invoice`, {
      headers: { Authorization: `Bearer ${customer.accessToken}` },
    });
    assert.equal(invoice.status, 200);
    const pdf = Buffer.from(await invoice.arrayBuffer());
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    await mkdir("var", { recursive: true });
    await writeFile("var/qa-invoice.pdf", pdf);
    const form = new FormData();
    form.append(
      "file",
      new Blob(
        [
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5LkAAAAASUVORK5CYII=",
            "base64",
          ),
        ],
        { type: "image/png" },
      ),
      "test.png",
    );
    const imageResponse = await fetch(`${base}/shop/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customer.accessToken}` },
      body: form,
    });
    assert.equal(imageResponse.status, 201);
    const image = (await imageResponse.json()).data;
    uploaded = new URL(image.url).pathname.split("/").pop();
    assert.equal((await fetch(image.url)).status, 200);
    const r = await api(
      `/shop/orders/${o.id}/returns`,
      "POST",
      { reason: "Dữ liệu kiểm thử local", evidence: image.url },
      customer.accessToken,
      201,
    );
    await api(
      `/shop/admin/returns/${r.id}`,
      "PUT",
      { action: "APPROVE", note: "Kiểm thử" },
      owner.accessToken,
    );
    await api(
      `/shop/admin/returns/${r.id}`,
      "PUT",
      {
        action: "RECEIVE",
        note: "Kiểm thử không thực hiện chuyển tiền",
        restock: true,
        refund: 120000,
      },
      owner.accessToken,
    );
    assert.equal(
      (await db.inventory.findUniqueOrThrow({ where: { productId } })).onHand,
      1,
    );
    const stock = await api(
      "/shop/admin/dashboard",
      "GET",
      undefined,
      owner.accessToken,
    );
    assert.ok(Array.isArray(stock.inventory));
    console.log(
      "HTTP smoke passed: auth, CORS, permissions, reserve, server totals, COD, delivery, PDF, upload, return and stock.",
    );
  } finally {
    if (userId) {
      const orders = await db.order.findMany({
        where: { customerId: userId },
        select: { id: true },
      });
      await db.returnRequest.deleteMany({
        where: { orderId: { in: orders.map((o) => o.id) } },
      });
      await db.order.deleteMany({ where: { customerId: userId } });
    }
    if (productId) {
      await db.stockEntry.deleteMany({ where: { productId } });
      await db.product.delete({ where: { id: productId } });
    }
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    if (userId) await db.user.delete({ where: { id: userId } });
    if (uploaded && /^[a-f0-9-]{36}\.png$/.test(uploaded))
      await unlink(path.join(process.cwd(), "var", "uploads", uploaded)).catch(
        () => {},
      );
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
