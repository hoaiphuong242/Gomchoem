import { requireUser } from "@/services/auth.service";
import { returnResult } from "@/services/payment.service";
import { apiSuccess, handleApiError } from "@/lib/response";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return apiSuccess(await returnResult(await requireUser(request), new URL(request.url).searchParams));
  } catch (error) { return handleApiError(error); }
}
