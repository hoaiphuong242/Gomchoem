import "./load-env";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/prisma";
import { transaction } from "../src/repositories/shop.repo";
import { reserve, submitOrder } from "../src/services/shop.service";
import { checkoutSchema } from "../src/schemas/shop.schema";
import { canonical, hmac } from "../src/lib/vnpay";

const marker = "var/integrations-ui-fixture.json";
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Local preview only");
  const db = getPrisma();
  if (process.argv.includes("--cleanup")) {
    const fixture = JSON.parse(await readFile(marker, "utf8")) as { userId: string; productId: string; categoryId: string; simulatedPayment?: boolean };
    await transaction(async tx => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: fixture.userId } });
      const product = await tx.product.findUniqueOrThrow({ where: { id: fixture.productId } });
      if (!user.email.endsWith("@ui-preview.invalid") || !product.sku.startsWith("UI-PREVIEW-")) throw new Error("Fixture identity mismatch");
      const orders = await tx.order.findMany({ where: { customerId: user.id }, include: { items: true } });
      if (orders.some(o=>(o.paymentStatus === "PAID" && !fixture.simulatedPayment) || o.items.some(i=>i.productId !== product.id))) throw new Error("Fixture changed; manual review needed");
      await tx.order.deleteMany({ where: { customerId: user.id } });
      await tx.product.delete({ where: { id: product.id } });
      await tx.category.delete({ where: { id: fixture.categoryId } });
      await tx.user.delete({ where: { id: user.id } });
    });
    await unlink(marker);
    await unlink("var/ui-preview-return-url.txt").catch(() => undefined);
    console.log("Removed only the local UI preview fixture.");
    return;
  }
  try { await readFile(marker); throw new Error("Preview fixture already exists; clean it first"); } catch(error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
  const key = randomUUID();
  const user = await db.user.create({ data: { email: `${key}@ui-preview.invalid`, name: "Khách kiểm tra giao diện", passwordHash: await hash("LocalPreview123!", 12), phone: "0900000000", address: "Địa chỉ thử nghiệm", city: "Đà Nẵng" } });
  const category = await db.category.create({ data: { name: `UI Preview ${key}`, slug: `ui-preview-${key}` } });
  const product = await db.product.create({ data: { name: "Bát gốm kiểm tra giao diện", sku: `UI-PREVIEW-${key}`, slug: `ui-preview-${key}`, categoryId: category.id, description: "Sản phẩm kiểm thử tạm thời, sẽ được dọn sau khi kiểm tra.", price: 100000, inventory: { create: { onHand: 1 } }, images: { create: { url: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=600&q=80" } } } });
  await mkdir("var", { recursive: true });
  const simulatedPayment = process.argv.includes("--payment");
  await writeFile(marker, JSON.stringify({ userId: user.id, productId: product.id, categoryId: category.id, simulatedPayment }));
  console.log(JSON.stringify({ email: user.email, slug: product.slug }));
  if (simulatedPayment) {
    const reservation = await reserve(user, [{ productId: product.id, quantity: 1 }]);
    const order = await submitOrder(user, reservation.id, checkoutSchema.parse({ recipientName: user.name, phone: user.phone, address: user.address, city: user.city, paymentMethod: "VNPAY" }));
    // This is a simulated local payment, never sent to a bank or an email recipient.
    await db.emailDelivery.create({ data: { orderId: order.id, kind: "ORDER_RECEIVED", status: "SKIPPED" } });
    const payment = await db.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } });
    const fields = { vnp_TmnCode: process.env.VNPAY_TMN_CODE!, vnp_TxnRef: payment.reference, vnp_Amount: String(order.total * 100), vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: String(Date.now()) };
    const params = new URLSearchParams({ ...fields, vnp_SecureHash: hmac(canonical(fields)) });
    await writeFile("var/ui-preview-return-url.txt", `http://localhost:5173/thanh-toan/vnpay/ket-qua?${params}`);
    console.log(`Simulated return URL saved locally; orderId=${order.id}`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(()=>getPrisma().$disconnect());
