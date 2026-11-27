import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;
const globalForRedis = globalThis as unknown as {
  redis?: RedisClient;
  redisConnecting?: Promise<RedisClient>;
};

// Reuse one connection across hot reloads and concurrent requests.
export async function getRedis(): Promise<RedisClient> {
  if (!globalForRedis.redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is required");
    globalForRedis.redis = createClient({
      url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) =>
          retries >= 3 ? false : Math.min(200 * (retries + 1), 1000),
      },
    });
    globalForRedis.redis.on("error", () =>
      console.error("Redis connection error"),
    );
  }

  const client = globalForRedis.redis;
  if (!client.isOpen && !globalForRedis.redisConnecting) {
    globalForRedis.redisConnecting = client.connect().finally(() => {
      globalForRedis.redisConnecting = undefined;
    });
  }
  if (globalForRedis.redisConnecting) await globalForRedis.redisConnecting;
  if (!client.isReady)
    throw new Error("Redis is reconnecting; try again shortly");
  return client;
}
