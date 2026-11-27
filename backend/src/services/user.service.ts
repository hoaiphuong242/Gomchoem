import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/errors";
import { userRepository } from "@/repositories/user.repo";
import type {
  CreateUserInput,
  UpdateUserInput,
  ListUsersInput,
} from "@/schemas/user.schema";
import {
  requireAdmin,
  requireOwnerOrAdmin,
  type AuthUser,
} from "@/services/auth.service";

function databaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      throw new ApiError("Email đã được sử dụng", 409);
    if (error.code === "P2025")
      throw new ApiError("Không tìm thấy người dùng", 404);
  }
  throw error;
}

export async function createUser(input: CreateUserInput) {
  if (await userRepository.findByEmail(input.email))
    throw new ApiError("Email đã được sử dụng", 409);
  const passwordHash = await hash(input.password, 12);
  try {
    return await userRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
  } catch (error) {
    databaseError(error);
  }
}

export async function createManagedUser(
  actor: AuthUser,
  input: CreateUserInput,
) {
  requireAdmin(actor);
  return createUser(input);
}

export async function listUsers(actor: AuthUser, input: ListUsersInput) {
  requireAdmin(actor);
  const users = await userRepository.list(
    (input.page - 1) * input.limit,
    input.limit,
  );
  return { users, page: input.page, limit: input.limit };
}

export async function getUser(actor: AuthUser, id: string) {
  requireOwnerOrAdmin(actor, id);
  const user = await userRepository.findById(id);
  if (!user) throw new ApiError("Không tìm thấy người dùng", 404);
  return user;
}

export async function updateUser(
  actor: AuthUser,
  id: string,
  input: UpdateUserInput,
) {
  requireOwnerOrAdmin(actor, id);
  const { password, ...fields } = input;
  const data = {
    ...fields,
    ...(password ? { passwordHash: await hash(password, 12) } : {}),
  };
  try {
    return await userRepository.update(id, data);
  } catch (error) {
    databaseError(error);
  }
}

export async function deleteUser(actor: AuthUser, id: string) {
  requireOwnerOrAdmin(actor, id);
  try {
    await userRepository.delete(id);
    return { id };
  } catch (error) {
    databaseError(error);
  }
}
