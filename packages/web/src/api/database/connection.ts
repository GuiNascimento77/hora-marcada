import { db as managedDb } from "./index";

// O cliente SQLite local compartilha a conexão. Transações concorrentes nela
// podem interferir no commit/rollback uma da outra; serialize apenas nesse modo.
export const db = managedDb;
if (process.env.DATABASE_URL?.startsWith("file:")) {
  const transaction = db.transaction.bind(db);
  let queue: Promise<unknown> = Promise.resolve();
  db.transaction = ((...args: Parameters<typeof transaction>) => {
    const result = queue.then(() => transaction(...args));
    queue = result.catch(() => undefined);
    return result;
  }) as typeof db.transaction;
}
