import { compare } from "bcryptjs";
import { ApiError } from "@/lib/errors";
import {
  bearerToken,
  createToken,
  tokenLifetimeSeconds,
  verifyToken,
} from "@/lib/jwt";
import { userRepository } from "@/repositories/user.repo";
import type { LoginInput } from "@/schemas/auth.schema";
import type { CreateUserInput } from "@/schemas/user.schema";
import { createUser } from "@/services/user.service";

export async function register(input: CreateUserInput) {
  const user = await createUser(input);
  return user;
}

export async function login(input: LoginInput) {
  const user = await userRepository.findByEmail(input.email);
  // Perform a password comparison even for unknown emails.
  const valid = await compare(
    input.password,
    user?.passwordHash ??
      "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
  );
  if (!user || !valid)
    throw new ApiError("Email hoặc mật khẩu không đúng", 401);
  const publicUser = await userRepository.findById(user.id);
  return {
    user: publicUser,
    accessToken: await createToken(user.id),
    tokenType: "Bearer",
    expiresIn: tokenLifetimeSeconds,
  };
}

export async function requireUser(request: Request) {
  const id = await verifyToken(bearerToken(request));
  const user = await userRepository.findById(id);
  if (!user) throw new ApiError("Tài khoản không còn tồn tại", 401);
  return user;
}

export type AuthUser = Awaited<ReturnType<typeof requireUser>>;

export function requireAdmin(user: AuthUser) {
  if (user.role !== "ADMIN")
    throw new ApiError("Bạn không có quyền thực hiện thao tác này", 403);
}

export function requireOwnerOrAdmin(user: AuthUser, id: string) {
  if (user.id !== id) requireAdmin(user);
}
