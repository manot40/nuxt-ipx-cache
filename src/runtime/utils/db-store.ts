import { join } from 'node:path';

import { createDatabase as createDB, type Database } from 'db0';

export function createDatabase(): Database | undefined {
  const db = <Database>{};

  resolveDB().then((database) => {
    if (database) Object.assign(db, database);
    if (Object.keys(db).length > 0)
      db.sql`
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          hash TEXT, meta TEXT,
          expired_at INT
        ) WITHOUT ROWID;
        CREATE UNIQUE INDEX unique_hash_index ON cache(hash);
      `.catch(console.error);
  });

  return db;
}

async function resolveDB() {
  if (typeof Bun == 'undefined' && !process.getBuiltinModule?.('node:sqlite')) return;

  const { default: connector } = await (typeof Bun != 'undefined'
    ? import('db0/connectors/bun-sqlite')
    : import('db0/connectors/node-sqlite'));

  return createDB(connector({ path: join(process.cwd(), '.cache/ipx/data.db') }));
}
