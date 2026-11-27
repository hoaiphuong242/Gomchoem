import PDFDocument from "pdfkit";
import path from "node:path";
import type { getOrder } from "@/services/shop.service";
import { publicSettings } from "@/services/account.service";

const money = (n: number) => `${n.toLocaleString("vi-VN")} đ`;
const methods = {
  COD: "Khi nhận hàng",
  TRANSFER: "Chuyển khoản",
  CASH: "Tiền mặt",
  VNPAY: "VNPay",
};
const paymentLabels = {
  UNPAID: "Chưa thu tiền",
  AWAITING_REVIEW: "Chờ đối soát",
  PAID: "Đã thu tiền",
  REFUNDED: "Đã ghi nhận hoàn tiền",
};
export async function invoicePdf(
  order: Awaited<ReturnType<typeof getOrder>>,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 45 });
  const settings = await publicSettings();
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.font(path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"));
  doc.fillColor("#654b38").fontSize(24).text("GỐM CHO EM");
  doc.fontSize(10).text("Đà Nẵng • @gomchoem").moveDown();
  if (settings.address) doc.text(settings.address);
  if (settings.phone) doc.text(settings.phone);
  doc.fontSize(18).text("BIÊN NHẬN BÁN HÀNG");
  doc
    .fontSize(10)
    .text(`Mã đơn: ${order.code}`)
    .text(
      `Ngày: ${order.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
    );
  doc.text(`Khách hàng: ${order.recipientName} • ${order.phone}`);
  doc.text(
    `Nhận hàng: ${order.pickup ? "Nhận tại cửa hàng" : `${order.address}, ${order.city}`}`,
  );
  doc
    .text(
      `Thanh toán: ${methods[order.paymentMethod]} • ${paymentLabels[order.paymentStatus]}`,
    )
    .moveDown();
  doc.fontSize(11);
  for (const item of order.items) {
    if (doc.y > 680) doc.addPage();
    doc.text(`${item.name} (${item.sku})`);
    doc
      .fontSize(10)
      .text(
        `${item.quantity} × ${money(item.unitPrice)} = ${money(item.quantity * item.unitPrice)}`,
        { align: "right" },
      )
      .moveDown(0.5)
      .fontSize(11);
  }
  doc.moveDown().text(`Tạm tính: ${money(order.subtotal)}`, { align: "right" });
  doc.text(`Giảm giá: -${money(order.discount)}`, { align: "right" });
  doc.text(`Phí giao hàng: ${money(order.shippingFee)}`, { align: "right" });
  doc.fontSize(15).text(`Tổng cộng: ${money(order.total)}`, { align: "right" });
  doc
    .moveDown()
    .fontSize(9)
    .text(
      "Đổi trả trong 48 giờ từ khi nhận hàng. Vui lòng giữ video mở kiện nếu hàng bị vỡ khi vận chuyển.",
    );
  doc.text(
    "Đây là biên nhận bán hàng, không thay thế hóa đơn điện tử có mã của cơ quan thuế.",
  );
  doc
    .moveDown()
    .text("Cảm ơn bạn đã mang một món gốm về nhà.", { align: "center" });
  doc.end();
  return result;
}
