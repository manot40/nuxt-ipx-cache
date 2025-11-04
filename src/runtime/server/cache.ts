import type { OutgoingHttpHeaders } from 'node:http';

import { createStorage } from 'unstorage';
import fsDriver from 'unstorage/drivers/fs-lite';

/**
 * @param cacheDir Persistance cache directory.
 * @param defaultTTL Default TTL in seconds
 */
export function createIPXCache(cacheDir: string, defaultTTL = 86400) {
  const store = createStorage<string>({ driver: fsDriver({ base: cacheDir }) });
  return <CacheStorage>{
    async get(path) {
      const raw = await store.getItemRaw(path);
      if (!Buffer.isBuffer(raw)) return;

      const meta = await store.getItem<OutgoingHttpHeaders>(`${path}.json`);
      const lastMod = new Date(meta?.expires || 0).getTime();
      const expiresIn = lastMod + defaultTTL * 1000;
      // Check if blob is expired using staled HTTP headers
      if (Date.now() > expiresIn) {
        // Item is expired, delete it and return nothing.
        await this.del(path);
        return;
      }

      return { meta, data: new Blob([raw]) };
    },

    async set(path, { data, meta }) {
      await Promise.all([
        store.setItemRaw(path, Buffer.isBuffer(data) ? data : await data.arrayBuffer()),
        store.setItem(`${path}.json`, JSON.stringify(meta)),
      ]).catch(console.error);
    },

    async del(path) {
      const promises = [store.removeItem(path), store.removeItem(`${path}.json`)];
      await Promise.all(promises).catch(() => void 0);
    },

    clear() {
      store.clear();
    },
  };
}

interface CachedData {
  data: Blob;
  meta: OutgoingHttpHeaders;
}

type PayloadData = Omit<CachedData, 'data'> & { data: Blob | Buffer };

interface CacheStorage {
  set: (path: string, val: PayloadData) => Promise<void>;
  get: (path: string) => Promise<CachedData | undefined>;
  del: (path: string) => Promise<void>;
  clear: () => void;
}
