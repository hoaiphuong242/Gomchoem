import { z } from "zod";
import * as notices from "@/services/notification.service";
import { readJson } from "@/lib/request";
import { apiSuccess, handleApiError } from "@/lib/response";
import { ApiError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/services/auth.service";
import * as shop from "@/services/shop.service";
import * as account from "@/services/account.service";
import { media, upload } from "@/services/media.service";
import { invoicePdf } from "@/services/invoice.service";
import { checkoutPayment } from "@/services/payment.service";
import { retryEmail } from "@/services/email.service";
import * as schema from "@/schemas/shop.schema";
import { categories, resolveProductId } from "@/repositories/catalog.repo";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handler(request: Request, context: Context) {
  try {
    const segments = (await context.params).path;
    const [resource, id, action] = segments;
    const method = request.method;
    const url = new URL(request.url);
    if (segments.length > 3) throw new ApiError("Không tìm thấy API", 404);
    if (method === "GET" && resource === "products" && !id)
      return apiSuccess(await shop.products(url.searchParams));
    if (method === "GET" && resource === "products" && id && !action)
      return apiSuccess(await shop.product(id));
    if (method === "GET" && resource === "settings")
      return apiSuccess(await account.publicSettings());
    if (method === "GET" && resource === "categories" && !id)
      return apiSuccess(await categories());
    if (method === "GET" && resource === "media" && id) {
      const file = await media(id);
      return new Response(new Uint8Array(file.data), {
        headers: {
          "Content-Type": file.type,
          "Cache-Control": "public, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (method === "POST" && resource === "inquiries" && !id) {
      await rateLimit("inquiries-global", 100, 3600);
      return apiSuccess(
        await account.inquiry(
          schema.inquirySchema.parse(await readJson(request)),
        ),
        201,
      );
    }
    const actor = await requireUser(request);
    if (resource === "notifications" && !action) {
      if (!id && method === "GET") return apiSuccess(await notices.notifications(actor));
      if (id === "read" && method === "POST") {
        const input = z.strictObject({ id: z.uuid().optional() }).parse(await readJson(request));
        return apiSuccess(await notices.readNotifications(actor, input.id));
      }
      if (id === "tokens" && ["POST", "DELETE"].includes(method)) {
        await rateLimit(`push-token:${actor.id}`, 30, 3600);
        const tokenSchema = z.string().min(20).max(4096);
        const input = (method === "POST" ? z.strictObject({ token: tokenSchema, projectId: z.string().min(1).max(100) }) : z.strictObject({ token: tokenSchema })).parse(await readJson(request));
        if ("projectId" in input && input.projectId !== process.env.FIREBASE_PROJECT_ID?.trim()) throw new ApiError("Frontend và backend đang dùng hai Firebase project khác nhau. Tiệm cần kiểm tra cấu hình.", 422);
        return apiSuccess(method === "POST" ? await notices.registerPushToken(actor, input.token) : await notices.removePushToken(actor, input.token));
      }
    }
    if (resource === "account" && !id) {
      if (method === "GET") return apiSuccess(await account.account(actor));
      if (method === "PUT")
        return apiSuccess(
          await account.saveProfile(
            actor,
            schema.profileSchema.parse(await readJson(request)),
          ),
        );
    }
    if (resource === "wishlist" && id && ["POST", "DELETE"].includes(method))
      return apiSuccess(
        await account.toggleWishlist(
          actor,
          schema.idSchema.parse(id),
          method === "DELETE",
        ),
      );
    if (
      resource === "products" &&
      id &&
      action === "reviews" &&
      method === "POST"
    )
      return apiSuccess(
        await account.review(
          actor,
          await resolveProductId(id),
          schema.reviewSchema.parse(await readJson(request)),
        ),
      );
    if (resource === "uploads" && method === "POST") {
      if (Number(request.headers.get("content-length") ?? 0) > 51 * 1024 * 1024)
        throw new ApiError("File quá lớn", 413);
      await rateLimit(`uploads:${actor.id}`, 30, 3600);
      const file = (await request.formData()).get("file");
      if (!(file instanceof File)) throw new ApiError("Thiếu file", 422);
      const result = await upload(file);
      return apiSuccess(
        { url: new URL(result.url, request.url).toString() },
        201,
      );
    }
    if (resource === "reservations" && !id && method === "POST") {
      await rateLimit(`reserve:${actor.id}`, 20, 600);
      return apiSuccess(
        await shop.reserve(
          actor,
          schema.reserveSchema.parse(await readJson(request)).items,
        ),
        201,
      );
    }
    if (resource === "orders") {
      if (!id && method === "GET")
        return apiSuccess(await shop.listOrders(actor, false));
      schema.idSchema.parse(id);
      if (method === "GET" && !action)
        return apiSuccess(await shop.getOrder(actor, id));
      if (method === "POST" && action === "vnpay") {
        await rateLimit(`vnpay:${actor.id}`, 30, 600);
        return apiSuccess(await checkoutPayment(actor, id, request));
      }
      if (method === "GET" && action === "invoice") {
        const order = await shop.getOrder(actor, id);
        if (!order.submittedAt)
          throw new ApiError("Đơn chưa được xác nhận", 409);
        const data = await invoicePdf(order);
        return new Response(new Uint8Array(data), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${order.code}.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (method === "POST" && action === "quote")
        return apiSuccess(
          await shop.quote(
            actor,
            id,
            schema.checkoutSchema.parse(await readJson(request)),
          ),
        );
      if (method === "POST" && action === "submit")
        return apiSuccess(
          await shop.submitOrder(
            actor,
            id,
            schema.checkoutSchema.parse(await readJson(request)),
          ),
        );
      if (method === "POST" && action === "cancel")
        return apiSuccess(
          await shop.changeOrder(
            actor,
            id,
            schema.statusSchema.parse({
              action: "CANCEL",
              note: "Khách yêu cầu hủy",
            }),
          ),
        );
      if (method === "POST" && action === "returns") {
        const input = schema.returnSchema.parse(await readJson(request));
        return apiSuccess(
          await shop.requestReturn(actor, id, input.reason, input.evidence),
          201,
        );
      }
    }
    if (resource === "admin") {
      shop.requireStaff(actor);
      if (id === "emails" && action && method === "POST") {
        await rateLimit(`email-retry:${actor.id}`, 20, 3600);
        return apiSuccess(await retryEmail(actor, schema.idSchema.parse(action)));
      }
      if (id === "returns" && !action && method === "POST") {
        const input = z
          .strictObject({
            orderId: schema.idSchema,
            reason: z.string().trim().min(1).max(2000),
            evidence: schema.webUrlSchema,
          })
          .parse(await readJson(request));
        return apiSuccess(
          await shop.requestReturn(
            actor,
            input.orderId,
            input.reason,
            input.evidence,
          ),
          201,
        );
      }
      if (id === "settings" && method === "PUT")
        return apiSuccess(
          await account.saveSettings(
            actor,
            schema.settingsSchema.parse(await readJson(request)),
          ),
        );
      if (id === "dashboard" && method === "GET")
        return apiSuccess(await account.dashboard(actor));
      if (id === "orders" && method === "GET")
        return apiSuccess(await shop.listOrders(actor, true));
      if (id === "orders" && action && method === "PUT")
        return apiSuccess(
          await shop.changeOrder(
            actor,
            schema.idSchema.parse(action),
            schema.statusSchema.parse(await readJson(request)),
          ),
        );
      if (id === "products" && method === "GET")
        return apiSuccess(await shop.products(url.searchParams, true));
      if (id === "products" && ["POST", "PUT"].includes(method))
        return apiSuccess(
          await shop.saveProduct(
            actor,
            schema.productSchema.parse(await readJson(request)),
            action ? schema.idSchema.parse(action) : undefined,
          ),
        );
      if (id === "stock" && method === "POST")
        return apiSuccess(
          await shop.adjustStock(
            actor,
            schema.stockSchema.parse(await readJson(request)),
          ),
        );
      if (id === "pos" && method === "POST")
        return apiSuccess(
          await shop.posOrder(
            actor,
            schema.posSchema.parse(await readJson(request)),
          ),
          201,
        );
      if (id === "returns" && action && method === "PUT")
        return apiSuccess(
          await shop.reviewReturn(
            actor,
            schema.idSchema.parse(action),
            schema.reviewReturnSchema.parse(await readJson(request)),
          ),
        );
      if (id === "vouchers" && method === "POST")
        return apiSuccess(
          await account.saveVoucher(
            actor,
            schema.voucherSchema.parse(await readJson(request)),
          ),
        );
      if (id === "inquiries" && action && method === "PUT")
        return apiSuccess(
          await account.resolveInquiry(actor, schema.idSchema.parse(action)),
        );
      if (id === "users" && action && method === "PUT") {
        const input = z
          .strictObject({
            role: z.enum(["USER", "ADMIN", "CASHIER", "WAREHOUSE"]),
          })
          .parse(await readJson(request));
        return apiSuccess(
          await account.changeRole(
            actor,
            schema.idSchema.parse(action),
            input.role,
          ),
        );
      }
    }
    throw new ApiError("Không tìm thấy API", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
