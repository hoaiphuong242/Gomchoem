import { readJson } from "@/lib/request";
import { apiSuccess, handleApiError } from "@/lib/response";
import { updateUserSchema, userIdSchema } from "@/schemas/user.schema";
import { requireUser } from "@/services/auth.service";
import { deleteUser, getUser, updateUser } from "@/services/user.service";
import type { UserRouteContext } from "@/types/api.type";

export async function GET(request: Request, context: UserRouteContext) {
  try {
    const actor = await requireUser(request);
    const id = userIdSchema.parse((await context.params).id);
    return apiSuccess(await getUser(actor, id));
  } catch (error) { return handleApiError(error); }
}

export async function PUT(request: Request, context: UserRouteContext) {
  try {
    const actor = await requireUser(request);
    const id = userIdSchema.parse((await context.params).id);
    const input = updateUserSchema.parse(await readJson(request));
    return apiSuccess(await updateUser(actor, id, input));
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request, context: UserRouteContext) {
  try {
    const actor = await requireUser(request);
    const id = userIdSchema.parse((await context.params).id);
    return apiSuccess(await deleteUser(actor, id));
  } catch (error) { return handleApiError(error); }
}
