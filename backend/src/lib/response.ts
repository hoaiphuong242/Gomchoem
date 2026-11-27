import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiResponse } from "@/types/api.type";
import { ApiError } from "@/lib/errors";
import { Prisma } from "@/generated/prisma/client";

const headers = { "Cache-Control": "no-store" };

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data },
    { status, headers },
  );
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: { message, ...(details ? { details } : {}) } },
    { status, headers },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError)
    return apiError("Dữ liệu không hợp lệ", 422, error.issues);
  if (error instanceof ApiError) return apiError(error.message, error.status);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return apiError(
        "Dữ liệu đã tồn tại (mã sản phẩm, email hoặc mã đơn)",
        409,
      );
    if (error.code === "P2025") return apiError("Không tìm thấy dữ liệu", 404);
    if (error.code === "P2003")
      return apiError("Dữ liệu đang được tham chiếu hoặc không tồn tại", 409);
    if (error.code === "P2034")
      return apiError(
        "Có người vừa cập nhật cùng dữ liệu, vui lòng thử lại",
        409,
      );
  }
  console.error("API error:", error);
  return apiError("Lỗi hệ thống", 500);
}
