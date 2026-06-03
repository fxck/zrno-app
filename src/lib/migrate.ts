import { getMigrations } from 'better-auth/db/migration'
import { auth, authOptions } from './auth'
import { getPool } from './db'

// Run once per process, on the first DB-touching request. Idempotent:
// better-auth creates only missing tables; app tables use IF NOT EXISTS.
let done: Promise<void> | null = null

export function ensureDb(): Promise<void> {
  if (!done) {
    done = run().catch((e) => {
      done = null // allow retry on a later request if the DB was briefly down
      throw e
    })
  }
  return done
}

async function run() {
  const { runMigrations } = await getMigrations(authOptions)
  await runMigrations()

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_name text NOT NULL,
      email text NOT NULL,
      items jsonb NOT NULL,
      total integer NOT NULL,
      currency text NOT NULL DEFAULT 'CZK',
      status text NOT NULL DEFAULT 'pending',
      payment_provider text,
      payment_reference text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  await seedAdmin()
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) return
  const res = await getPool().query('SELECT 1 FROM "user" WHERE email = $1 LIMIT 1', [email])
  if (res.rowCount) return
  try {
    await auth.api.signUpEmail({ body: { email, password, name: 'ZRNO Admin' } })
    console.log('[seed] admin user created:', email)
  } catch (e) {
    console.error('[seed] admin create failed:', e)
  }
}
