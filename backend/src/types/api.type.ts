export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; details?: unknown } };

export type UserRouteContext = { params: Promise<{ id: string }> };
