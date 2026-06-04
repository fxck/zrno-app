import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { passkey } from '@better-auth/passkey'
import { getPool } from './db'

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.zeropsSubdomain ||
  'http://localhost:3000'

// WebAuthn binds a credential to a relying-party ID (the registrable
// domain) and an exact origin. Derive both from baseURL so a passkey
// registered on the live subdomain validates there — and `localhost`
// works for local dev (the one host browsers exempt from HTTPS).
const { hostname: rpID, origin: rpOrigin } = new URL(baseURL)

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
  plugins: [
    passkey({
      rpID,
      rpName: 'ZRNO Back Office',
      origin: rpOrigin,
    }),
    // tanstack cookies plugin stays last so it wraps the final response.
    tanstackStartCookies(),
  ],
}

export const auth = betterAuth(authOptions)
