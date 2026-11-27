import { readJson } from "@/lib/request";
import { apiSuccess, handleApiError } from "@/lib/response";
import { loginSchema } from "@/schemas/auth.schema";
import { login } from "@/services/auth.service";
import { rateLimit } from "@/lib/rate-limit";
import { createHash } from "node:crypto";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await readJson(request));
    await rateLimit(`login:${createHash("sha256").update(input.email).digest("hex")}`, 10, 300);
    return apiSuccess(await login(input));
  } catch (error) { return handleApiError(error); }
}
