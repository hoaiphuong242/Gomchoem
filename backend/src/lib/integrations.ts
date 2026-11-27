import { ApiError } from "@/lib/errors";

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError(`Tiệm chưa cấu hình ${name}`, 503);
  return value;
}
export const vnpayReady = () => ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL"].every(k => !!process.env[k]?.trim());
export const cloudinaryReady = () => ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].every(k => !!process.env[k]?.trim());
export const sendgridReady = () => ["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"].every(k => !!process.env[k]?.trim());
