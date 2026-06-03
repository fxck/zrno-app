import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    host: true,
    // Behind the Zerops L7 subdomain, the dev server receives a proxied
    // Host header — allow it so Vite doesn't 403 the request.
    allowedHosts: true,
  },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: {
        // better-auth's kysely-adapter dynamically imports Bun/Node/D1 SQLite
        // dialects that reference kysely internals not re-exported in 0.29.
        // We use Postgres only, so these are never loaded at runtime — keep
        // them out of the server bundle to avoid the build-time export error.
        external: [/^@sentry\//, /(bun|node|d1)-sqlite-dialect/],
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
