import "./load-env";
import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/prisma";
import { createUserSchema } from "../src/schemas/user.schema";

async function main() {
  const input = createUserSchema.parse({
    name: process.env.ADMIN_NAME ?? "Chủ tiệm",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  const existing = await getPrisma().user.findUnique({
    where: { email: input.email },
  });
  if (existing)
    throw new Error(
      "Email đã tồn tại. Dùng Prisma Studio để kiểm tra và cấp quyền có chủ đích.",
    );
  await getPrisma().user.create({
    data: {
      email: input.email,
      name: input.name,
      role: "ADMIN",
      passwordHash: await hash(input.password, 12),
    },
  });
  console.log("Đã tạo tài khoản chủ tiệm.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
