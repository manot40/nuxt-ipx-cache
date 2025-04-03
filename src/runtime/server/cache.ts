import type { OutgoingHttpHeaders } from 'node:http';

import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { createStorage } from 'unstorage';
import { createDatabase } from '../utils/db-store';

import fsDriver from 'unstorage/drivers/fs-lite';

const DEFAULT_TTL = 86400;

/**
 * @param cacheDir Persistance cache directory.
 * @param defaultTTL Default TTL in seconds
 */
export function createIPXCache(cacheDir: string, defaultTTL = DEFAULT_TTL) {
  const db = createDatabase();
  const store = createStorage<string>({ driver: fsDriver({ base: cacheDir }) });
  const timers: TimersMap = new Map();

  return <CacheStorage>{
    async get(key) {
      if (db?.sql) {
        const data = await db.sql<{ test: '' }>`SELECT * FROM cache WHERE key = ${key}`;
        console.log('select', data);
      } else {
        const raw = await store.getItemRaw(key);
        if (!Buffer.isBuffer(raw)) return;
        const meta = await store.getItem<OutgoingHttpHeaders>(`${key}.json`);
        const expired = handleExpiration(key, meta?.expires, this, timers);
        if (!expired) return { meta, data: new Blob([raw]) };
      }
    },

    async set(key, { data, meta }, ttl = defaultTTL) {
      if (timers.has(key)) clearTimeout(timers.get(key));
      const timeout = setTimeout(() => this.del(key), ttl * 1000);

      const bin = Buffer.isBuffer(data) ? data : await data.arrayBuffer();
      const hash = createHash('sha1')
        .update(bin as Buffer)
        .digest('hex');
      const metadata = JSON.stringify(meta);

      let savePath = key;

      if (db?.sql) {
        savePath = join(cacheDir, hash);
        const t = await db.sql`
          INSERT INTO cache (key, hash, meta, expired_at)
          VALUES (${key}, ${hash}, ${metadata}, ${Date.now() + ttl * 1000})
          ON CONFLICT (key, hash) DO NOTHING`;
        console.log('insert', t);
      } else {
        store.setItem(`${key}.json`, metadata);
      }

      await store.setItemRaw(savePath, bin).catch(console.error);
      timers.set(key, timeout);
    },

    async del(path) {
      if (timers.has(path)) clearTimeout(timers.get(path));
      timers.delete(path);

      const promises = [store.removeItem(path), store.removeItem(`${path}.json`)];
      await Promise.all(promises).catch(() => void 0);
    },

    clear() {
      store.clear();
      for (const v of timers.values()) clearTimeout(v);
      timers.clear();
    },
  };
}

function handleExpiration(key: string, expires: string | undefined, store: CacheStorage, timers?: TimersMap) {
  const lastMod = new Date(expires && !Number.isNaN(+expires) ? +expires : 0).getTime();
  const expiresIn = lastMod + DEFAULT_TTL * 1000;
  // Check if blob is expired using staled HTTP headers
  if (Date.now() > expiresIn) return true;

  if (timers && !timers.has(key)) {
    const timeout = setTimeout(() => store.del(key), expiresIn - Date.now());
    timers.set(key, timeout);
  }

  return false;
}

interface CachedData {
  data: Blob;
  meta: OutgoingHttpHeaders;
}

type TimersMap = Map<string, NodeJS.Timeout>;
type PayloadData = Omit<CachedData, 'data'> & { data: Blob | Buffer };

interface CacheStorage {
  set: (path: string, val: PayloadData, ttl?: number) => Promise<void>;
  get: (path: string) => Promise<CachedData | undefined>;
  del: (path: string) => Promise<void>;
  clear: () => void;
}
