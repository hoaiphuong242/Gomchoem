import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());
export const passwordSchema = z
  .string()
  .min(8)
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Mật khẩu không được vượt quá 72 bytes",
  );

export const createUserSchema = z.strictObject({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
  password: passwordSchema,
});

export const updateUserSchema = createUserSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Cần ít nhất một trường để cập nhật",
  );
export const userIdSchema = z.uuid();
export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
