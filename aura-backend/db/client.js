import pg from 'pg';
import dotenv from 'dotenv';
import { PGlite } from '@electric-sql/pglite';

dotenv.config();

const { Pool } = pg;

const usingEmbeddedDb = !process.env.DATABASE_URL;

const embeddedDb = usingEmbeddedDb ? new PGlite('./.aura-pglite') : null;

export const pool = usingEmbeddedDb
  ? {
      async query(text, params = []) {
        if ((!params || params.length === 0) && text.includes(';')) {
          await embeddedDb.exec(text);
          return { rows: [], rowCount: 0 };
        }
        return embeddedDb.query(text, params);
      },
      async close() {
        await embeddedDb.close();
      }
    }
  : new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

if (usingEmbeddedDb) {
  console.log(`${new Date().toISOString()} DATABASE_URL not set; using embedded PGlite database at aura-backend/.aura-pglite`);
}

export async function closePool() {
  if (typeof pool.end === 'function') await pool.end();
  else if (typeof pool.close === 'function') await pool.close();
}
