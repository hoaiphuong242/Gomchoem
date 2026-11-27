import { getPrisma } from "@/lib/prisma";
import { adminMessaging, firebaseAdminReady } from "@/lib/firebaseAdmin";
import { transaction } from "@/repositories/shop.repo";
import type { AuthUser } from "@/services/auth.service";
import { ApiError } from "@/lib/errors";
import type { Message } from "firebase-admin/messaging";

export function notificationScopes(role: string) {
  return role === "ADMIN" ? ["CUSTOMER", "ORDERS", "INQUIRIES", "RETURNS"] : role === "CASHIER" ? ["CUSTOMER", "ORDERS", "INQUIRIES"] : role === "WAREHOUSE" ? ["CUSTOMER", "ORDERS"] : ["CUSTOMER"];
}
export async function notifications(actor: AuthUser) {
  const db = getPrisma();
  const where = { userId: actor.id, scope: { in: notificationScopes(actor.role) } };
  const [items, unread, orders, inquiries, returns] = await db.$transaction([
    db.notification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    db.notification.count({ where: { ...where, readAt: null } }),
    db.order.count({ where: actor.role === "USER" ? { id: { in: [] } } : { submittedAt: { not: null }, status: { in: ["PENDING_PAYMENT", "CONFIRMED", "PACKING"] } } }),
    db.inquiry.count({ where: ["ADMIN", "CASHIER"].includes(actor.role) ? { resolved: false } : { id: { in: [] } } }),
    db.returnRequest.count({ where: actor.role === "ADMIN" ? { status: { in: ["REQUESTED", "APPROVED"] } } : { id: { in: [] } } }),
  ]);
  return { items, unread, counts: { orders, inquiries, returns }, pushEnabled: firebaseAdminReady() };
}
export async function readNotifications(actor: AuthUser, id?: string) {
  const result = await getPrisma().notification.updateMany({ where: { userId: actor.id, scope: { in: notificationScopes(actor.role) }, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  return { updated: result.count };
}
export async function registerPushToken(actor: AuthUser, token: string) {
  if (!firebaseAdminReady()) throw new ApiError("Tiệm chưa cấu hình Firebase để gửi thông báo đẩy", 503);
  return transaction(async tx => {
    const existing = await tx.pushToken.findUnique({ where: { token } });
    if (existing && existing.userId !== actor.id) await tx.pushDelivery.deleteMany({ where: { tokenId: existing.id } });
    await tx.pushToken.upsert({ where: { token }, create: { token, userId: actor.id }, update: { userId: actor.id } });
    return { registered: true };
  });
}
export async function removePushToken(actor: AuthUser, token: string) {
  await getPrisma().pushToken.deleteMany({ where: { userId: actor.id, token } });
  return { removed: true };
}
export async function processPushNotifications(send: (message: Message) => Promise<string> = message => adminMessaging().send(message)) {
  if (!firebaseAdminReady()) return;
  const db = getPrisma();
  const now = new Date();
  const jobs = await db.pushDelivery.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, take: 40, orderBy: { nextAttemptAt: "asc" } });
  for (const job of jobs) {
    const claimed = await db.pushDelivery.updateMany({ where: { id: job.id, status: "PENDING", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, data: { lockedUntil: new Date(Date.now() + 120_000), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    const current = await db.pushDelivery.findUnique({ where: { id: job.id }, include: { notification: true, token: { include: { user: { select: { role: true } } } } } });
    if (!current) continue;
    const { notification: notice, token } = current;
    if (notice.userId !== token.userId || !notificationScopes(token.user.role).includes(notice.scope) || notice.readAt) {
      await db.pushDelivery.updateMany({ where: { id: job.id }, data: { status: "SKIPPED", lockedUntil: null } }); continue;
    }
    try {
      // Deliver the same event content shown in the recipient's notification list.
      await send({ token: token.token, data: { notificationId: notice.id, title: notice.title, body: notice.body, url: notice.scope === "CUSTOMER" ? "/tai-khoan" : notice.url, userId: notice.userId }, webpush: { headers: { TTL: "3600", Urgency: "normal" } } });
      await db.pushDelivery.updateMany({ where: { id: job.id }, data: { status: "SENT", lockedUntil: null, lastError: null } });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code)) {
        await db.pushToken.deleteMany({ where: { id: token.id, userId: notice.userId } }); continue;
      }
      const safeError = code.startsWith("messaging/") || code.startsWith("app/") ? code.replace(/[^a-z0-9/\-]/gi, "").slice(0,100) : "FCM chưa kết nối được. Kiểm tra cấu hình Firebase Admin.";
      await db.pushDelivery.updateMany({ where: { id: job.id }, data: { status: job.attempts >= 7 ? "FAILED" : "PENDING", lastError: safeError, lockedUntil: null, nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000) } });
      console.warn("Thông báo đẩy chưa gửi được:", job.id, safeError);
    }
  }
}
