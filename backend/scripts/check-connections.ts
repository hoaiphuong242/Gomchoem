import "./load-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../src/lib/prisma";
import { getRedis } from "../src/lib/redis";

async function main() {
  const prisma = getPrisma();
  let redis: Awaited<ReturnType<typeof getRedis>> | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.user.count();
    console.log("PostgreSQL: connected; User table ready");

    const clients = await Promise.all([getRedis(), getRedis()]);
    redis = clients[0];
    assert.equal(clients[0], clients[1]);
    assert.equal(await redis.ping(), "PONG");
    const key = `connection-check:${randomUUID()}`;
    try {
      await redis.set(key, "ok", { EX: 30 });
      assert.equal(await redis.get(key), "ok");
    } finally {
      await redis.del(key);
    }
    console.log("Redis: connected; PING and SET/GET passed; singleton reused");
  } finally {
    await prisma.$disconnect();
    if (redis?.isOpen) await redis.close();
  }
}

main().catch(() => {
  console.error(
    "Connection check failed. Check Docker, .env and run npm run db:deploy first.",
  );
  process.exitCode = 1;
});
