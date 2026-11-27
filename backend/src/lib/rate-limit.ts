import { getRedis } from "@/lib/redis";
import { ApiError } from "@/lib/errors";

export async function rateLimit(key: string, limit: number, seconds: number) {
  const redis = await getRedis();
  const count = Number(
    await redis.eval(
      "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
      { keys: [`gce:limit:${key}`], arguments: [String(seconds)] },
    ),
  );
  if (count > limit)
    throw new ApiError(
      "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
      429,
    );
}
