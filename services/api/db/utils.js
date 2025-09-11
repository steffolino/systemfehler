/**
 * Query helper that works with both sqlite3 (local dev) and Cloudflare D1 (Worker).
 * Always returns an array (never undefined).
 */
export async function queryAll(db, sql, params = []) {
  if (typeof db.all === "function") {
    // sqlite3 (local dev)
    return db.all(sql, params);
  } else if (db.prepare) {
    // Cloudflare D1
    const stmt = db.prepare(sql);
    const result = await stmt.all(...params);
    return result?.results ?? [];
  }
  throw new Error("Unsupported DB client");
}

/**
 * Run helper for INSERT/UPDATE/DELETE.
 */
export async function run(db, sql, params = []) {
  if (typeof db.run === "function") {
    // sqlite3
    return db.run(sql, params);
  } else if (db.prepare) {
    // Cloudflare D1
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }
  throw new Error("Unsupported DB client");
}
