import { Pool, PoolClient, types } from 'pg';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

export function createPool(databaseUrl: string) {
  // DATE is a calendar value, not a local-midnight instant. Preserve birthdays
  // and reporting days when the server runs east or west of UTC.
  types.setTypeParser(1082, value => value);
  const pool = new Pool({ connectionString: databaseUrl, max: 10, connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000, statement_timeout: 5000, application_name: 'healthguard' });
  pool.on('error', () => console.error('Database pool connection error'));
  return pool;
}

export async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function migrate(pool: Pool) {
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(73492016)");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ DEFAULT NOW())');
    const directory = path.join(__dirname, '../migrations');
    for (const name of fs.readdirSync(directory).filter((file) => file.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(path.join(directory, name), 'utf8');
      // Git/Windows line endings must not make identical migrations incompatible.
      const canonical = sql.replace(/\r\n/g, '\n');
      const checksum = createHash('sha256').update(canonical).digest('hex');
      const windowsChecksum = createHash('sha256').update(canonical.replace(/\n/g, '\r\n')).digest('hex');
      const applied = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
      if (applied.rows.length) {
        if (![checksum, windowsChecksum].includes(applied.rows[0].checksum)) throw new Error(`Migration checksum mismatch: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
    }
  });
}
