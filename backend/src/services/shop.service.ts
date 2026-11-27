import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { vnpayReady } from "@/lib/integrations";
import {
  canReturn,
  loyaltyRate,
  reserveMilliseconds,
  shippingFee,
} from "@/lib/shop-rules";
import {
  transaction,
  expireReservations,
  orderInclude,
  productInclude,
  type Tx,
} from "@/repositories/shop.repo";
import { requireAdmin, type AuthUser } from "@/services/auth.service";
import {
  posSchema,
  productSchema,
  reviewReturnSchema,
  statusSchema,
  stockSchema,
  type CartItems,
  type CheckoutInput,
} from "@/schemas/shop.schema";

export function requireStaff(
  actor: AuthUser,
  roles = ["ADMIN", "CASHIER", "WAREHOUSE"],
) {
  if (!roles.includes(actor.role))
    throw new ApiError("Bạn không có quyền thực hiện thao tác này", 403);
}
function ownOrder(actor: AuthUser, customerId: string | null) {
  if (
    actor.id !== customerId &&
    !["ADMIN", "CASHIER", "WAREHOUSE"].includes(actor.role)
  )
    throw new ApiError("Không có quyền xem đơn hàng", 403);
}
const code = () =>
  `GCE-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

export async function products(params: URLSearchParams, admin = false) {
  await transaction(expireReservations);
  const page = Math.min(10000, Math.max(1, Number(params.get("page")) || 1));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 12));
  const query = (params.get("q") ?? "").slice(0, 100);
  const category = params.get("category");
  const where = {
    ...(admin ? {} : { active: true }),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { sku: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(category ? { category: { slug: category } } : {}),
    ...(params.get("unique") === "true" ? { inventory: { onHand: 1 } } : {}),
  };
  const orderBy =
    params.get("sort") === "price-asc"
      ? { price: "asc" as const }
      : params.get("sort") === "price-desc"
        ? { price: "desc" as const }
        : { createdAt: "desc" as const };
  const [items, total] = await Promise.all([
    getPrisma().product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    getPrisma().product.count({ where }),
  ]);
  return {
    items: items.map((p) => {
      const { costPrice, ...publicProduct } = p;
      return {
        ...(admin ? p : publicProduct),
        available: (p.inventory?.onHand ?? 0) - (p.inventory?.reserved ?? 0),
      };
    }),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}
export async function product(slug: string) {
  await transaction(expireReservations);
  const p = await getPrisma().product.findFirst({
    where: { slug, active: true },
    include: {
      ...productInclude,
      reviews: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!p) throw new ApiError("Không tìm thấy sản phẩm", 404);
  const { costPrice: _costPrice, ...result } = p;
  return {
    ...result,
    available: (p.inventory?.onHand ?? 0) - (p.inventory?.reserved ?? 0),
  };
}
export async function reserve(actor: AuthUser, items: CartItems) {
  return transaction(async (tx) => {
    await expireReservations(tx);
    const merged = new Map<string, number>();
    for (const item of items)
      merged.set(
        item.productId,
        (merged.get(item.productId) ?? 0) + item.quantity,
      );
    // One active checkout per customer; repeat requests reuse its reservation.
    const existing = await tx.order.findFirst({
      where: { customerId: actor.id, status: "RESERVED" },
      include: orderInclude,
    });
    if (existing) {
      if (
        existing.items.length === merged.size &&
        existing.items.every((i) => merged.get(i.productId) === i.quantity)
      )
        return existing;
      for (const i of existing.items)
        await tx.inventory.update({
          where: { productId: i.productId },
          data: { reserved: { decrement: i.quantity } },
        });
      await tx.order.update({
        where: { id: existing.id },
        data: {
          status: "CANCELLED",
          events: {
            create: { message: "Thay giỏ hàng, kết thúc phiên giữ hàng cũ." },
          },
        },
      });
    }
    const pending = await tx.order.count({
      where: { customerId: actor.id, status: "PENDING_PAYMENT" },
    });
    if (pending >= 3)
      throw new ApiError(
        "Bạn có đơn chuyển khoản đang chờ xác nhận. Vui lòng liên hệ tiệm trước khi đặt thêm.",
        409,
      );
    const selected = [];
    let subtotal = 0;
    for (const [productId, quantity] of [...merged.entries()].sort()) {
      const p = await tx.product.findUnique({
        where: { id: productId },
        include: productInclude,
      });
      if (
        !p?.active ||
        !p.inventory ||
        p.inventory.onHand - p.inventory.reserved < quantity
      )
        throw new ApiError(
          `${p?.name ?? "Sản phẩm"} không còn đủ hàng. Vui lòng cập nhật giỏ.`,
          409,
        );
      await tx.inventory.update({
        where: { productId },
        data: { reserved: { increment: quantity } },
      });
      subtotal += p.price * quantity;
      if (subtotal > 1_000_000_000)
        throw new ApiError(
          "Giá trị đơn vượt giới hạn, vui lòng liên hệ tiệm",
          422,
        );
      selected.push({
        productId,
        quantity,
        name: p.name,
        sku: p.sku,
        image: p.images[0]?.url ?? "",
        unitPrice: p.price,
      });
    }
    return tx.order.create({
      data: {
        code: code(),
        customerId: actor.id,
        subtotal,
        total: subtotal,
        expiresAt: new Date(Date.now() + reserveMilliseconds),
        items: { create: selected },
        events: { create: { message: "Bắt đầu giữ hàng 3 phút." } },
      },
      include: orderInclude,
    });
  });
}
async function priceOrder(
  tx: Tx,
  actor: AuthUser,
  subtotal: number,
  input: CheckoutInput,
  useVoucher: boolean,
) {
  const history = await tx.orderItem.aggregate({
    where: {
      order: {
        customerId: actor.id,
        status: "DELIVERED",
        returns: { none: { status: "RECEIVED" } },
      },
    },
    _sum: { quantity: true },
  });
  let discount = Math.round(subtotal * loyaltyRate(history._sum.quantity ?? 0));
  if (input.voucherCode) {
    const voucher = await tx.voucher.findUnique({
      where: { code: input.voucherCode },
    });
    if (
      !voucher?.active ||
      (voucher.expiresAt && voucher.expiresAt < new Date()) ||
      voucher.used >= voucher.maxUses ||
      subtotal < voucher.minTotal
    )
      throw new ApiError(
        "Mã giảm giá không hợp lệ, đã hết lượt hoặc chưa đạt giá trị tối thiểu",
        422,
      );
    discount += voucher.amount;
    if (useVoucher)
      await tx.voucher.update({
        where: { code: voucher.code },
        data: { used: { increment: 1 } },
      });
  }
  discount = Math.min(subtotal, discount);
  const shipping = shippingFee(input.city, input.pickup);
  return {
    subtotal,
    discount,
    shippingFee: shipping,
    total: subtotal - discount + shipping,
  };
}
export async function quote(actor: AuthUser, id: string, input: CheckoutInput) {
  return transaction(async (tx) => {
    await expireReservations(tx);
    const order = await tx.order.findUnique({ where: { id } });
    if (!order || order.customerId !== actor.id)
      throw new ApiError("Không tìm thấy phiên giữ hàng", 404);
    if (order.status !== "RESERVED")
      throw new ApiError("Phiên giữ hàng đã kết thúc", 409);
    return priceOrder(tx, actor, order.subtotal, input, false);
  });
}
export async function submitOrder(
  actor: AuthUser,
  id: string,
  input: CheckoutInput,
) {
  if (input.paymentMethod === "VNPAY" && !vnpayReady()) throw new ApiError("Tiệm chưa cấu hình thanh toán VNPay", 503);
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order || order.customerId !== actor.id)
      throw new ApiError("Không tìm thấy đơn", 404);
    if (order.submittedAt) return order; // Network retry must not spend a voucher twice.
    if (
      order.status !== "RESERVED" ||
      !order.expiresAt ||
      order.expiresAt <= new Date()
    )
      throw new ApiError("Đã hết 3 phút giữ hàng. Vui lòng quay lại giỏ.", 409);
    const totals = await priceOrder(tx, actor, order.subtotal, input, true);
    const online = input.paymentMethod === "VNPAY";
    if (online && totals.total < 5000) throw new ApiError("VNPay yêu cầu đơn từ 5.000đ. Vui lòng chọn COD hoặc chuyển khoản.", 422);
    const paymentExpires = new Date(Date.now() + 15 * 60_000);
    return tx.order.update({
      where: { id },
      data: {
        ...input,
        voucherCode: input.voucherCode || null,
        ...totals,
        submittedAt: new Date(),
        expiresAt: online ? paymentExpires : null,
        status:
          input.paymentMethod === "TRANSFER" || online ? "PENDING_PAYMENT" : "CONFIRMED",
        paymentStatus:
          input.paymentMethod === "TRANSFER" ? "AWAITING_REVIEW" : "UNPAID",
        ...(online ? { payment: { create: { reference: randomUUID().replaceAll("-", ""), amount: totals.total, expiresAt: paymentExpires, nextCheckAt: new Date(Date.now() + 30_000) } } } : { emails: { create: { kind: "ORDER_RECEIVED" } } }),
        events: {
          create: {
            message:
              online ? "Đã mở phiên VNPay 15 phút. Tiếp tục giữ hàng trong lúc cổng thanh toán xử lý." : input.paymentMethod === "TRANSFER"
                ? "Khách báo đã chuyển khoản. Chờ nhân viên đối soát, tiếp tục giữ hàng."
                : "Đã xác nhận đặt hàng COD.",
          },
        },
      },
      include: orderInclude,
    });
  });
}
export async function getOrder(actor: AuthUser, id: string) {
  await transaction(expireReservations);
  const order = await getPrisma().order.findUnique({
    where: { id },
    include: orderInclude,
  });
  if (!order) throw new ApiError("Không tìm thấy đơn", 404);
  ownOrder(actor, order.customerId);
  return order;
}
export async function listOrders(actor: AuthUser, admin: boolean) {
  if (admin) requireStaff(actor);
  await transaction(expireReservations);
  return getPrisma().order.findMany({
    where: {
      ...(admin ? {} : { customerId: actor.id }),
      submittedAt: { not: null },
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
export async function changeOrder(
  actor: AuthUser,
  id: string,
  input: z.infer<typeof statusSchema>,
) {
  return transaction(async (tx) => {
    const o = await tx.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!o) throw new ApiError("Không tìm thấy đơn", 404);
    if (o.paymentMethod === "VNPAY" && o.status === "PENDING_PAYMENT") throw new ApiError("VNPay đang xử lý. Cần có kết quả đối soát trước khi thay đổi hoặc hủy đơn.", 409);
    const customer = actor.id === o.customerId && actor.role === "USER";
    if (customer && o.paymentStatus === "AWAITING_REVIEW") throw new ApiError("Đơn chuyển khoản cần tiệm đối soát ngân hàng trước khi hủy. Vui lòng liên hệ tiệm.", 409);
    if (customer) {
      if (
        input.action !== "CANCEL" ||
        !["RESERVED", "PENDING_PAYMENT", "CONFIRMED", "PACKING"].includes(
          o.status,
        )
      )
        throw new ApiError(
          "Vui lòng liên hệ tiệm để xử lý đơn đã bàn giao vận chuyển",
          409,
        );
    } else
      requireStaff(
        actor,
        input.action === "PACK" || input.action === "SHIP"
          ? ["ADMIN", "CASHIER", "WAREHOUSE"]
          : ["ADMIN", "CASHIER"],
      );
    if (input.action === "CONFIRM_PAYMENT") {
      if (o.paymentMethod !== "TRANSFER" || o.status !== "PENDING_PAYMENT")
        throw new ApiError("Đơn không chờ đối soát chuyển khoản", 409);
      return tx.order.update({
        where: { id },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          status: "CONFIRMED",
          emails: { create: { kind: "PAYMENT_CONFIRMED" } },
          events: {
            create: { message: "Nhân viên đã xác nhận tiền chuyển khoản." },
          },
        },
        include: orderInclude,
      });
    }
    const targets = {
      PACK: "PACKING",
      SHIP: "SHIPPED",
      DELIVER: "DELIVERED",
      CANCEL: "CANCELLED",
    } as const;
    const target = targets[input.action];
    const valid =
      input.action === "PACK"
        ? o.status === "CONFIRMED"
        : input.action === "SHIP"
          ? o.status === "PACKING" && !o.pickup
          : input.action === "DELIVER"
            ? o.status === "SHIPPED" ||
              (o.pickup && ["CONFIRMED", "PACKING"].includes(o.status))
            : [
                "RESERVED",
                "PENDING_PAYMENT",
                "CONFIRMED",
                "PACKING",
                "SHIPPED",
              ].includes(o.status);
    if (!valid)
      throw new ApiError(
        "Thao tác không hợp lệ với trạng thái đơn hiện tại",
        409,
      );
    if (input.action === "CANCEL" && o.paymentStatus === "PAID") {
      requireAdmin(actor);
      if (
        !input.refundConfirmed ||
        !input.note.trim() ||
        input.refundAmount > o.total
      )
        throw new ApiError(
          "Chủ tiệm cần xác nhận hoàn tiền thực tế, số tiền và ghi chú đối soát trước khi hủy",
          409,
        );
    }
    if (input.action === "CANCEL" && o.paymentStatus === "AWAITING_REVIEW" && !input.note.trim()) throw new ApiError("Ghi chú kết quả kiểm tra ngân hàng trước khi hủy đơn chờ chuyển khoản", 409);
    const consume =
      input.action === "SHIP" ||
      (input.action === "DELIVER" && o.status !== "SHIPPED");
    if (consume || input.action === "CANCEL") {
      for (const item of o.items) {
        // Shipped cancellation waits for physical return; do not fabricate stock.
        if (o.status === "SHIPPED") continue;
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            reserved: { decrement: item.quantity },
            ...(consume ? { onHand: { decrement: item.quantity } } : {}),
          },
        });
        if (consume)
          await tx.stockEntry.create({
            data: {
              productId: item.productId,
              actorId: actor.id,
              type: "SALE",
              quantity: -item.quantity,
              note: o.code,
            },
          });
      }
    }
    if (input.action === "CANCEL" && o.voucherCode)
      await tx.voucher.update({
        where: { code: o.voucherCode },
        data: { used: { decrement: 1 } },
      });
    return tx.order.update({
      where: { id },
      data: {
        status: target,
        ...(input.action === "CANCEL" && o.paymentStatus === "PAID"
          ? { paymentStatus: "REFUNDED", refundAmount: input.refundAmount }
          : {}),
        ...(input.action === "SHIP"
          ? { trackingCode: input.trackingCode }
          : {}),
        ...(input.action === "DELIVER"
          ? {
              deliveredAt: new Date(),
              paymentStatus: "PAID",
              paidAt: o.paidAt ?? new Date(),
            }
          : {}),
        events: {
          create: {
            message: `${target}${input.action === "CANCEL" && o.status === "SHIPPED" ? " — Khách chịu phí ship; hàng chưa nhập lại kho." : ""}${input.note ? `: ${input.note}` : ""}`,
          },
        },
      },
      include: orderInclude,
    });
  });
}
export async function saveProduct(
  actor: AuthUser,
  input: z.infer<typeof productSchema>,
  id?: string,
) {
  requireAdmin(actor);
  const { images, ...data } = input;
  return transaction(async (tx) =>
    id
      ? tx.product.update({
          where: { id },
          data: {
            ...data,
            images: {
              deleteMany: {},
              create: images.map((url, position) => ({ url, position })),
            },
          },
          include: productInclude,
        })
      : tx.product.create({
          data: {
            ...data,
            inventory: { create: {} },
            images: {
              create: images.map((url, position) => ({ url, position })),
            },
          },
          include: productInclude,
        }),
  );
}
export async function adjustStock(
  actor: AuthUser,
  input: z.infer<typeof stockSchema>,
) {
  requireStaff(actor, ["ADMIN", "WAREHOUSE"]);
  if (input.type === "ADJUSTMENT") requireAdmin(actor);
  if (input.type === "IMPORT" && input.quantity < 0)
    throw new ApiError("Nhập hàng phải có số lượng dương", 422);
  return transaction(async (tx) => {
    const stock = await tx.inventory.findUnique({
      where: { productId: input.productId },
    });
    if (!stock || stock.onHand + input.quantity < stock.reserved)
      throw new ApiError(
        "Tồn kho sau điều chỉnh phải đủ cho hàng đang giữ",
        409,
      );
    await tx.inventory.update({
      where: { productId: input.productId },
      data: { onHand: { increment: input.quantity } },
    });
    return tx.stockEntry.create({ data: { ...input, actorId: actor.id } });
  });
}
export async function posOrder(
  actor: AuthUser,
  input: z.infer<typeof posSchema>,
) {
  requireStaff(actor, ["ADMIN", "CASHIER"]);
  return transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { requestKey: input.requestKey },
      include: orderInclude,
    });
    if (existing) {
      if (existing.createdById !== actor.id)
        throw new ApiError("Mã yêu cầu không hợp lệ", 409);
      return existing;
    }
    await expireReservations(tx);
    const items = [];
    const merged = new Map<string, number>();
    for (const i of input.items)
      merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
    let subtotal = 0;
    const orderCode = code();
    const immediate = input.channel === "STORE";
    for (const [productId, quantity] of [...merged.entries()].sort()) {
      const p = await tx.product.findUnique({
        where: { id: productId },
        include: productInclude,
      });
      if (
        !p?.active ||
        !p.inventory ||
        p.inventory.onHand - p.inventory.reserved < quantity
      )
        throw new ApiError(`${p?.name ?? "Sản phẩm"} không còn đủ hàng`, 409);
      await tx.inventory.update({
        where: { productId },
        data: immediate
          ? { onHand: { decrement: quantity } }
          : { reserved: { increment: quantity } },
      });
      if (immediate)
        await tx.stockEntry.create({
          data: {
            productId,
            actorId: actor.id,
            type: "SALE",
            quantity: -quantity,
            note: orderCode,
          },
        });
      subtotal += p.price * quantity;
      items.push({
        productId,
        quantity,
        name: p.name,
        sku: p.sku,
        image: p.images[0]?.url ?? "",
        unitPrice: p.price,
      });
    }
    const fee = shippingFee(input.city, immediate);
    return tx.order.create({
      data: {
        code: orderCode,
        requestKey: input.requestKey,
        createdById: actor.id,
        channel: input.channel,
        recipientName: input.name,
        phone: input.phone,
        address: input.address,
        city: input.city,
        note: input.note,
        pickup: immediate,
        paymentMethod: input.paymentMethod,
        paymentStatus: immediate
          ? "PAID"
          : input.paymentMethod === "TRANSFER"
            ? "AWAITING_REVIEW"
            : "UNPAID",
        status: immediate
          ? "DELIVERED"
          : input.paymentMethod === "TRANSFER"
            ? "PENDING_PAYMENT"
            : "CONFIRMED",
        subtotal,
        shippingFee: fee,
        total: subtotal + fee,
        submittedAt: new Date(),
        ...(immediate ? { deliveredAt: new Date(), paidAt: new Date() } : {}),
        items: { create: items },
        events: {
          create: {
            message: `Nhân viên tạo đơn kênh ${input.channel}${immediate ? ", đã thu tiền tại quầy" : ""}.`,
          },
        },
      },
      include: orderInclude,
    });
  });
}
export async function requestReturn(
  actor: AuthUser,
  id: string,
  reason: string,
  evidence: string,
) {
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { returns: true, events: true },
    });
    if (!order) throw new ApiError("Không tìm thấy đơn", 404);
    if (order.customerId !== actor.id) requireAdmin(actor);
    const cancelledShipment =
      actor.role === "ADMIN" &&
      order.status === "CANCELLED" &&
      order.events.some((e) => e.message.startsWith("SHIPPED"));
    if (
      !cancelledShipment &&
      (order.status !== "DELIVERED" || !canReturn(order.deliveredAt))
    )
      throw new ApiError(
        "Đơn không thuộc thời hạn đổi trả 48 giờ từ lúc nhận hàng",
        409,
      );
    if (order.returns.some((r) => r.status !== "REJECTED"))
      throw new ApiError("Đơn đã có yêu cầu đổi trả", 409);
    return tx.returnRequest.create({
      data: { orderId: id, userId: actor.id, reason, evidence },
    });
  });
}
export async function reviewReturn(
  actor: AuthUser,
  id: string,
  input: z.infer<typeof reviewReturnSchema>,
) {
  requireAdmin(actor);
  return transaction(async (tx) => {
    const r = await tx.returnRequest.findUnique({
      where: { id },
      include: { order: { include: { items: true } } },
    });
    if (!r) throw new ApiError("Không tìm thấy yêu cầu", 404);
    if (input.action === "RECEIVE") {
      if (r.status !== "APPROVED")
        throw new ApiError("Chỉ nhận lại hàng sau khi duyệt yêu cầu", 409);
      if (input.refund > r.order.total)
        throw new ApiError("Tiền hoàn không được vượt quá tiền đơn", 422);
      if (input.refund > 0 && r.order.paymentStatus !== "PAID")
        throw new ApiError(
          "Đơn chưa thu tiền hoặc đã hoàn tiền. Kiểm tra lại trước khi ghi nhận khoản hoàn mới.",
          409,
        );
      if (input.restock)
        for (const item of r.order.items) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: { onHand: { increment: item.quantity } },
          });
          await tx.stockEntry.create({
            data: {
              productId: item.productId,
              actorId: actor.id,
              quantity: item.quantity,
              type: "RETURN",
              note: r.order.code,
            },
          });
        }
      if (input.refund > 0)
        await tx.order.update({
          where: { id: r.orderId },
          data: {
            paymentStatus: "REFUNDED",
            refundAmount: input.refund,
            events: {
              create: {
                message: `Chủ tiệm ghi nhận đã hoàn ${input.refund}đ. ${input.note}`,
              },
            },
          },
        });
    } else if (r.status !== "REQUESTED")
      throw new ApiError("Yêu cầu đã được xử lý", 409);
    return tx.returnRequest.update({
      where: { id },
      data: {
        status:
          input.action === "APPROVE"
            ? "APPROVED"
            : input.action === "REJECT"
              ? "REJECTED"
              : "RECEIVED",
        restock: input.action === "RECEIVE" && input.restock,
        refund: input.action === "RECEIVE" ? input.refund : 0,
        staffNote: input.note,
      },
    });
  });
}
