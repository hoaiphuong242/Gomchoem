import { z } from "zod";

const text = (max = 200) => z.string().trim().min(1).max(max);
const money = z.number().int().min(0).max(100_000_000);
export const webUrlSchema = z.string().trim().max(1000).url().refine(value => /^https?:\/\//i.test(value), "Chỉ chấp nhận liên kết HTTP hoặc HTTPS");
export const idSchema = z.uuid();
export const itemsSchema = z
  .array(
    z.strictObject({
      productId: idSchema,
      quantity: z.number().int().min(1).max(100),
    }),
  )
  .min(1)
  .max(50);
export const reserveSchema = z.strictObject({ items: itemsSchema });
export const checkoutSchema = z
  .strictObject({
    recipientName: text(100),
    phone: z
      .string()
      .trim()
      .regex(/^(\+84|0)[0-9]{9,10}$/, "Số điện thoại không hợp lệ"),
    address: z.string().trim().max(500).default(""),
    city: z.string().trim().max(100).default(""),
    pickup: z.boolean().default(false),
    giftWrap: z.boolean().default(false),
    note: z.string().trim().max(2000).default(""),
    paymentMethod: z.enum(["COD", "TRANSFER", "VNPAY"]),
    voucherCode: z.string().trim().toUpperCase().max(40).default(""),
  })
  .refine(
    (v) => v.pickup || (v.address.length >= 5 && v.city.length > 0),
    "Vui lòng nhập địa chỉ và tỉnh/thành nhận hàng",
  );
export const productSchema = z.strictObject({
  name: text(),
  sku: text(50),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(200),
  categoryId: idSchema,
  description: text(10000),
  price: money,
  costPrice: money.default(0),
  conditionDetail: z.string().trim().max(2000).default(""),
  origin: text(100).default("Nhật Bản"),
  dimensions: z.string().trim().max(200).default(""),
  material: text().default("Gốm sứ"),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  images: z.array(webUrlSchema).min(1).max(12),
});
export const stockSchema = z.strictObject({
  productId: idSchema,
  quantity: z
    .number()
    .int()
    .min(-10000)
    .max(10000)
    .refine((v) => v !== 0),
  note: text(1000),
  type: z.enum(["IMPORT", "ADJUSTMENT"]).default("IMPORT"),
});
export const statusSchema = z.strictObject({
  action: z.enum(["CONFIRM_PAYMENT", "PACK", "SHIP", "DELIVER", "CANCEL"]),
  refundConfirmed: z.boolean().default(false),
  refundAmount: money.default(0),
  trackingCode: z.string().trim().max(100).default(""),
  note: z.string().trim().max(1000).default(""),
});
export const posSchema = z
  .strictObject({
    requestKey: idSchema,
    items: itemsSchema,
    name: text(100),
    phone: z.string().max(20).default(""),
    channel: z.enum(["STORE", "FACEBOOK", "INSTAGRAM"]),
    paymentMethod: z.enum(["CASH", "TRANSFER", "COD"]),
    address: z.string().trim().max(500).default(""),
    city: z.string().trim().max(100).default(""),
    note: z.string().max(2000).default(""),
  })
  .refine(
    (v) =>
      v.channel === "STORE" ||
      (v.phone.length >= 10 && v.address.length >= 5 && v.city.length > 0),
    "Đơn online cần điện thoại, địa chỉ và tỉnh/thành",
  )
  .refine(
    (v) => v.channel !== "STORE" || v.paymentMethod !== "COD",
    "Bán tại quầy dùng tiền mặt hoặc chuyển khoản",
  );
export const profileSchema = z.strictObject({
  name: text(100),
  phone: z.string().trim().max(20),
  address: z.string().trim().max(500),
  city: z.string().trim().max(100),
  notifyNew: z.boolean(),
});
export const inquirySchema = z.strictObject({
  name: text(100),
  phone: text(20),
  email: z.union([z.email(), z.literal("")]).default(""),
  topic: text(100),
  message: text(5000),
  imageUrl: z.union([webUrlSchema, z.literal("")]).default(""),
});
export const returnSchema = z.strictObject({
  reason: text(2000),
  evidence: webUrlSchema,
});
export const reviewReturnSchema = z.strictObject({
  action: z.enum(["APPROVE", "REJECT", "RECEIVE"]),
  restock: z.boolean().default(false),
  refund: money.default(0),
  note: text(2000),
});
export const voucherSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,40}$/),
  amount: money,
  minTotal: money,
  maxUses: z.number().int().min(1).max(100000),
  active: z.boolean(),
  expiresAt: z.iso.datetime().nullable().default(null),
});
export const reviewSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  content: text(2000),
});
export const settingsSchema = z.strictObject({
  address: z.string().trim().max(500),
  phone: z.string().trim().max(20),
  openingHours: z.string().trim().max(100),
  bankName: z.string().trim().max(100),
  bankAccount: z.string().trim().max(40),
  bankOwner: z.string().trim().max(100),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CartItems = z.infer<typeof itemsSchema>;
