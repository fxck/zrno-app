import { Pool } from 'pg'

let pool: Pool | null = null

// Lazy singleton. Constructed without throwing so the module is import-safe
// during build/SSR; connection errors only surface on the first query at runtime.
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    })
  }
  return pool
}

export async function query<T = any>(
  text: string,
  params: any[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params)
  return res.rows as T[]
}
