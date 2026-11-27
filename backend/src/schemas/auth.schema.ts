import { z } from "zod";
import {
  createUserSchema,
  emailSchema,
  passwordSchema,
} from "@/schemas/user.schema";

export const registerSchema = createUserSchema;
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;
