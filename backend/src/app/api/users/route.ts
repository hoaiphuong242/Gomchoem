import { readJson } from "@/lib/request";
import { apiSuccess, handleApiError } from "@/lib/response";
import { createUserSchema, listUsersSchema } from "@/schemas/user.schema";
import { requireUser } from "@/services/auth.service";
import { createManagedUser, listUsers } from "@/services/user.service";

export async function GET(request: Request) {
  try {
    const actor = await requireUser(request);
    const input = listUsersSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiSuccess(await listUsers(actor, input));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request);
    const input = createUserSchema.parse(await readJson(request));
    return apiSuccess(await createManagedUser(actor, input), 201);
  } catch (error) { return handleApiError(error); }
}
