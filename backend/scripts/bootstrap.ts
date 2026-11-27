import "./load-env";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const resolve = createRequire(path.join(process.cwd(), "package.json")).resolve;
async function run(module: string, args: string[]) {
  await new Promise<void>((accept, reject) => {
    const child = spawn(process.execPath, [resolve(module), ...args], {
      stdio: "inherit", windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? accept() : reject(new Error(`Khởi tạo thất bại (${module}). Kiểm tra PostgreSQL/DATABASE_URL; server chưa được mở.`)));
  });
}
async function main() {
  console.log("PostgreSQL: áp dụng migration và chuẩn bị dữ liệu...");
  await run("prisma/build/index.js", ["migrate", "deploy"]);
  await run("prisma/build/index.js", ["generate"]);
  if (process.env.DB_SEED_ON_START !== "false") await run("tsx/cli", ["scripts/seed.ts"]);
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") await run("tsx/cli", ["scripts/setup-local.ts"]);
  console.log("PostgreSQL: bảng và dữ liệu đã sẵn sàng.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
