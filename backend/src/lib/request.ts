import { ApiError } from "@/lib/errors";

export async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 1024 * 1024) throw new ApiError("Dữ liệu gửi lên quá lớn", 413);
  try {
    return await request.json();
  } catch {
    throw new ApiError("JSON không hợp lệ", 400);
  }
}
