import { readJson } from "@/lib/request";
import { apiSuccess, handleApiError } from "@/lib/response";
import { registerSchema } from "@/schemas/auth.schema";
import { register } from "@/services/auth.service";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await readJson(request));
    await rateLimit("register-global", 30, 3600);
    return apiSuccess(await register(input), 201);
  } catch (error) { return handleApiError(error); }
}
