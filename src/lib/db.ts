import postgres from "postgres";
import { dbCache } from "@/lib/cache";

const connectionString = process.env.DATABASE_URL!;

// 生产环境使用连接池，开发环境单连接
const sql = postgres(connectionString, {
  max: process.env.NODE_ENV === "production" ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

/**
 * 带缓存的查询包装器。
 * @param key    缓存 key，建议格式：`"table:param1:param2"`
 * @param query  返回查询结果的异步函数
 * @param ttlMs  缓存有效期（毫秒），默认 60 秒
 */
async function cachedQuery<T>(key: string, query: () => Promise<T>, ttlMs = 60_000): Promise<T> {
  const cached = dbCache.get<T>(key);
  if (cached !== undefined) return cached;
  const result = await query();
  dbCache.set(key, result, ttlMs);
  return result;
}

/**
 * 使以 prefix 开头的所有缓存条目失效。
 * 写操作后调用，例如 invalidateCache("jobs:")
 */
function invalidateCache(prefix: string): void {
  dbCache.invalidate(prefix);
}

export default sql;
export { cachedQuery, invalidateCache };
