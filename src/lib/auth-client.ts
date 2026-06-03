import { createAuthClient } from 'better-auth/react'

// Same-origin: baseURL defaults to the current window origin in the browser.
export const authClient = createAuthClient()
