import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export const productInclude = {
  category: true,
  images: { orderBy: { position: "asc" as const } },
  inventory: true,
};
export const orderInclude = {
  items: true,
  events: { orderBy: { createdAt: "asc" as const } },
  returns: true,
  payment: { select: { status: true, expiresAt: true, transactionNo: true, lastError: true, lastCheckedAt: true } },
  emails: { select: { id: true, kind: true, status: true, sentAt: true, attempts: true, lastError: true } },
};
export type Tx = Prisma.TransactionClient;

// Serializable transactions retry serialization conflicts, never partially reserve a cart.
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPrisma().$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (error) {
      // Prisma 7's pg adapter can expose PostgreSQL serialization failures
      // directly at COMMIT instead of wrapping them in a P2034 error.
      const cause = error && typeof error === "object" && "cause" in error ? error.cause : null;
      const postgresConflict = cause && typeof cause === "object" && "originalCode" in cause && ["40001", "40P01"].includes(String(cause.originalCode));
      if (
        ((error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") || postgresConflict) &&
        attempt < 4
      )
        continue;
      throw error;
    }
  }
}

export async function expireReservations(tx: Tx) {
  const expired = await tx.order.findMany({
    where: { status: "RESERVED", expiresAt: { lte: new Date() } },
    include: { items: true },
    take: 200,
  });
  for (const order of expired) {
    const changed = await tx.order.updateMany({
      where: { id: order.id, status: "RESERVED" },
      data: { status: "EXPIRED" },
    });
    if (!changed.count) continue;
    for (const item of order.items)
      await tx.inventory.update({
        where: { productId: item.productId },
        data: { reserved: { decrement: item.quantity } },
      });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        message: "Hết 3 phút giữ hàng. Sản phẩm đã được mở bán trở lại.",
      },
    });
  }
}
