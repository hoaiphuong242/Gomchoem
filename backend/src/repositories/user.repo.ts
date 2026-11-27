import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const publicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userRepository = {
  findByEmail: (email: string) =>
    getPrisma().user.findUnique({ where: { email } }),
  findById: (id: string) =>
    getPrisma().user.findUnique({ where: { id }, select: publicSelect }),
  list: (skip: number, take: number) =>
    getPrisma().user.findMany({
      skip,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: publicSelect,
    }),
  create: (
    data: Pick<Prisma.UserCreateInput, "email" | "name" | "passwordHash">,
  ) => getPrisma().user.create({ data, select: publicSelect }),
  update: (
    id: string,
    data: Pick<Prisma.UserUpdateInput, "email" | "name" | "passwordHash">,
  ) => getPrisma().user.update({ where: { id }, data, select: publicSelect }),
  delete: (id: string) =>
    getPrisma().user.delete({ where: { id }, select: publicSelect }),
};
