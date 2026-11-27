import "./load-env";
import { randomBytes } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/prisma";

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Chỉ dùng setup-local cho máy phát triển");
  const db = getPrisma();
  if (await db.user.count({ where: { role: "ADMIN" } })) {
    console.log("Đã có chủ tiệm. Không tạo hoặc đổi thông tin đăng nhập.");
    return;
  }
  const email = "admin@gomchoem.local";
  const password = randomBytes(18).toString("base64url");
  await db.user.create({
    data: {
      name: "Chủ tiệm (local)",
      email,
      passwordHash: await hash(password, 12),
      role: "ADMIN",
    },
  });
  await appendFile(
    ".env.local",
    `\n# Tài khoản phát triển được tạo bởi npm run setup:local; không commit.\nADMIN_EMAIL="${email}"\nADMIN_PASSWORD="${password}"\n`,
  );
  console.log(
    "Đã tạo chủ tiệm local. Xem ADMIN_EMAIL / ADMIN_PASSWORD trong backend/.env.local.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
