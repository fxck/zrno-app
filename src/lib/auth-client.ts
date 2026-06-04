import { createAuthClient } from 'better-auth/react'
import { passkeyClient } from '@better-auth/passkey/client'

// Same-origin: baseURL defaults to the current window origin in the browser.
export const authClient = createAuthClient({
  plugins: [passkeyClient()],
})
