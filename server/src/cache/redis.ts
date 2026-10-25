import Redis from 'ioredis';

let redisClient: Redis | null = null;
let isRedisConnected = false;

// In-memory fallback cache with TTL support when standalone Redis is offline
interface CacheEntry {
  value: string;
  expiresAt: number;
}
const memoryCache = new Map<string, CacheEntry>();

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 2) {
          // Cease retrying excessively if offline, rely on resilient memory cache
          return null;
        }
        return 1000;
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('[Redis] Connected to Redis caching server.');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      // Do not crash, keep silent or log low severity
    });

    redisClient.connect().catch((err) => {
      isRedisConnected = false;
      console.log('[Redis] Standalone Redis not reachable at', redisUrl, '- Operating in resilient local cache fallback mode.');
    });
  } catch (err) {
    isRedisConnected = false;
  }

  return redisClient;
}

// Cache keys
export const CACHE_KEYS = {
  EVENT_DETAIL: (id: string) => `eventsphere:event:${id}`,
  EVENTS_LIST_PREFIX: 'eventsphere:events:list',
  EVENTS_LIST: (queryHash: string) => `eventsphere:events:list:${queryHash}`,
};

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

export async function getCached<T>(key: string): Promise<T | null> {
  // Try Redis first if connected
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch (e) {
      // Fall through to memory cache
    }
  }

  // Memory cache check
  const entry = memoryCache.get(key);
  if (entry) {
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  return null;
}

export async function setCached<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
  const serialized = JSON.stringify(value);

  // Store in memory cache
  memoryCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // Store in Redis if connected
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, serialized);
    } catch (e) {
      // Handled silently
    }
  }
}

export async function invalidateEventCache(eventId?: string): Promise<void> {
  // Clear memory cache entries matching prefix
  for (const k of Array.from(memoryCache.keys())) {
    if (k.startsWith(CACHE_KEYS.EVENTS_LIST_PREFIX) || (eventId && k === CACHE_KEYS.EVENT_DETAIL(eventId))) {
      memoryCache.delete(k);
    }
  }

  if (isRedisConnected && redisClient) {
    try {
      if (eventId) {
        await redisClient.del(CACHE_KEYS.EVENT_DETAIL(eventId));
      }
      const listKeys = await redisClient.keys(`${CACHE_KEYS.EVENTS_LIST_PREFIX}*`);
      if (listKeys.length > 0) {
        await redisClient.del(...listKeys);
      }
    } catch (e) {
      // Handled silently
    }
  }
}

export function getCacheStatus() {
  return {
    isRedisConnected,
    memoryCacheEntries: memoryCache.size,
    engine: isRedisConnected ? 'Redis (standalone)' : 'In-Memory Distributed Fallback',
  };
}
