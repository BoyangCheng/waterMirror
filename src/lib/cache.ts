interface CacheEntry {
  value: unknown;
  expires: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  /** 删除所有 key 中包含 prefix 的缓存条目 */
  invalidate(prefix: string): void {
    Array.from(this.store.keys()).forEach((key) => {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    });
  }

  clear(): void {
    this.store.clear();
  }
}

// 单例，整个进程共享
export const dbCache = new MemoryCache();
