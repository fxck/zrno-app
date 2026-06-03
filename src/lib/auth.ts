import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { getPool } from './db'

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.zeropsSubdomain ||
  'http://localhost:3000'

// Shared config object — also handed to getMigrations() so the schema
// always matches the running auth instance.
export const authOptions = {
  database: getPool(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  emailAndPassword: { enabled: true },
  trustedOrigins: [
    'http://localhost:3000',
    ...(process.env.zeropsSubdomain ? [process.env.zeropsSubdomain] : []),
    'https://appstage-24d9-3000.prg1.zerops.app',
    'https://appdev-24d9-3000.prg1.zerops.app',
  ],
  plugins: [tanstackStartCookies()],
}

export const auth = betterAuth(authOptions)
