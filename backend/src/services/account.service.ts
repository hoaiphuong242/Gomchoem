import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { vnpayReady, cloudinaryReady } from "@/lib/integrations";
import { transaction, productInclude } from "@/repositories/shop.repo";
import { loyaltyRate } from "@/lib/shop-rules";
import { requireAdmin, type AuthUser } from "@/services/auth.service";
import { requireStaff } from "@/services/shop.service";
import {
  inquirySchema,
  profileSchema,
  reviewSchema,
  voucherSchema,
  settingsSchema,
} from "@/schemas/shop.schema";

export async function publicSettings() {
  const data = await getPrisma().shopSettings.findUnique({
    where: { id: "shop" },
  });
  return { ...(
    data ?? {
      address: "",
      phone: "",
      openingHours: "",
      bankName: process.env.SHOP_BANK_NAME ?? "",
      bankAccount: process.env.SHOP_BANK_ACCOUNT ?? "",
      bankOwner: process.env.SHOP_BANK_OWNER ?? "",
    }
  ), vnpayEnabled: vnpayReady(), cloudinaryEnabled: cloudinaryReady() };
}
export async function saveSettings(
  actor: AuthUser,
  input: z.infer<typeof settingsSchema>,
) {
  requireAdmin(actor);
  return getPrisma().shopSettings.upsert({
    where: { id: "shop" },
    create: { id: "shop", ...input },
    update: input,
  });
}

export async function account(actor: AuthUser) {
  const [user, purchases, wishlist] = await Promise.all([
    getPrisma().user.findUniqueOrThrow({
      where: { id: actor.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        address: true,
        city: true,
        notifyNew: true,
        createdAt: true,
      },
    }),
    getPrisma().order.findMany({
      where: {
        customerId: actor.id,
        status: "DELIVERED",
        returns: { none: { status: "RECEIVED" } },
      },
      include: { items: true },
    }),
    getPrisma().wishlist.findMany({
      where: { userId: actor.id },
      include: { product: { include: productInclude } },
    }),
  ]);
  const quantity = purchases.reduce(
    (s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0),
    0,
  );
  return {
    user,
    quantity,
    spent: purchases.reduce((s, o) => s + o.total, 0),
    loyaltyRate: loyaltyRate(quantity),
    wishlist: wishlist.map((w) => {
      const { costPrice: _costPrice, ...p } = w.product;
      return {
        ...p,
        available: (p.inventory?.onHand ?? 0) - (p.inventory?.reserved ?? 0),
      };
    }),
  };
}
export async function saveProfile(
  actor: AuthUser,
  input: z.infer<typeof profileSchema>,
) {
  await getPrisma().user.update({ where: { id: actor.id }, data: input });
  return account(actor);
}
export async function toggleWishlist(
  actor: AuthUser,
  productId: string,
  remove: boolean,
) {
  if (remove)
    await getPrisma().wishlist.deleteMany({
      where: { userId: actor.id, productId },
    });
  else {
    const p = await getPrisma().product.findFirst({
      where: { id: productId, active: true },
    });
    if (!p) throw new ApiError("Không tìm thấy sản phẩm", 404);
    await getPrisma().wishlist.upsert({
      where: { userId_productId: { userId: actor.id, productId } },
      create: { userId: actor.id, productId },
      update: {},
    });
  }
  return { saved: !remove };
}
export async function inquiry(input: z.infer<typeof inquirySchema>) {
  return getPrisma().inquiry.create({ data: input, select: { id: true } });
}
export async function review(
  actor: AuthUser,
  productId: string,
  input: z.infer<typeof reviewSchema>,
) {
  const bought = await getPrisma().orderItem.findFirst({
    where: { productId, order: { customerId: actor.id, status: "DELIVERED" } },
  });
  if (!bought)
    throw new ApiError("Bạn cần nhận sản phẩm trước khi đánh giá", 403);
  return getPrisma().review.upsert({
    where: { userId_productId: { userId: actor.id, productId } },
    create: { userId: actor.id, productId, ...input },
    update: input,
  });
}
export async function dashboard(actor: AuthUser) {
  requireStaff(actor);
  const [orders, inventory, entries, inquiries, returns, vouchers, users] =
    await Promise.all([
      getPrisma().order.findMany({
        where: { submittedAt: { not: null } },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      getPrisma().product.findMany({
        include: productInclude,
        orderBy: { name: "asc" },
        take: 1000,
      }),
      getPrisma().stockEntry.findMany({
        include: {
          product: { select: { name: true, sku: true } },
          actor: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      actor.role === "ADMIN" || actor.role === "CASHIER"
        ? getPrisma().inquiry.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
          })
        : [],
      getPrisma().returnRequest.findMany({
        include: {
          order: {
            select: {
              code: true,
              total: true,
              items: true,
              paymentStatus: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      actor.role === "ADMIN" ? getPrisma().voucher.findMany() : [],
      actor.role === "ADMIN"
        ? getPrisma().user.findMany({
            select: { id: true, name: true, email: true, role: true },
            orderBy: { createdAt: "desc" },
            take: 200,
          })
        : [],
    ]);
  const paid = orders.filter((o) =>
    ["PAID", "REFUNDED"].includes(o.paymentStatus),
  );
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const key = d.toISOString().slice(0, 10);
    return {
      day: key,
      revenue: paid
        .filter((o) => o.paidAt?.toISOString().slice(0, 10) === key)
        .reduce((s, o) => s + o.total - o.refundAmount, 0),
    };
  });
  return {
    revenue: paid.reduce((s, o) => s + o.total - o.refundAmount, 0),
    orderCount: orders.length,
    pending: orders.filter((o) => o.status === "PENDING_PAYMENT").length,
    lowStock: inventory.filter(
      (p) =>
        p.active &&
        (p.inventory?.onHand ?? 0) - (p.inventory?.reserved ?? 0) <= 1,
    ).length,
    days,
    inventory: inventory.map((p) => ({
      ...p,
      available: (p.inventory?.onHand ?? 0) - (p.inventory?.reserved ?? 0),
    })),
    entries,
    inquiries,
    returns,
    vouchers,
    users,
  };
}
export async function saveVoucher(
  actor: AuthUser,
  input: z.infer<typeof voucherSchema>,
) {
  requireAdmin(actor);
  const data = {
    ...input,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  };
  return getPrisma().voucher.upsert({
    where: { code: input.code },
    create: data,
    update: data,
  });
}
export async function changeRole(
  actor: AuthUser,
  id: string,
  role: "USER" | "ADMIN" | "CASHIER" | "WAREHOUSE",
) {
  requireAdmin(actor);
  if (id === actor.id)
    throw new ApiError("Không tự thay đổi quyền của chính mình", 409);
  return transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, role: true },
    });
    return updated;
  });
}
export async function resolveInquiry(actor: AuthUser, id: string) {
  requireStaff(actor, ["ADMIN", "CASHIER"]);
  return getPrisma().inquiry.update({
    where: { id },
    data: { resolved: true },
  });
}
