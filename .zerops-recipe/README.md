# ZRNO — Zerops recipe

This file holds the **recipe-level content** Zerops renders on the recipe detail
page. Only the text between the `#ZEROPS_EXTRACT_*` markers is read; everything
else here is for humans browsing the repo. The deployable environments live in
the sibling `0 — Development/`, `1 — Stage/` and `2 — Production/` folders.

<!-- #ZEROPS_EXTRACT_START:name# -->
ZRNO
<!-- #ZEROPS_EXTRACT_END:name# -->

<!-- #ZEROPS_EXTRACT_START:intro# -->
ZRNO is a complete, production-shaped coffee-shop web app. Customers browse the
menu, fill a cart and check out, read a publishing-grade journal and subscribe
to updates; behind it sits a full admin back office for managing orders,
subscribers, passkey-secured accounts and a rich journal editor with image
uploads. It's built on TanStack Start (React 19, server-side rendered) and wires
itself to PostgreSQL, S3-compatible object storage, Meilisearch and SMTP email
out of the box — a real app you can fork into your own café, blog or storefront.
<!-- #ZEROPS_EXTRACT_END:intro# -->

<!-- #ZEROPS_EXTRACT_START:cover# -->
![ZRNO storefront](https://raw.githubusercontent.com/fxck/zrno-coffee/main/.zerops-recipe/cover.png)
<!-- #ZEROPS_EXTRACT_END:cover# -->

<!-- #ZEROPS_EXTRACT_START:features# -->
- **Storefront with cart & checkout** — browse the menu, build an order and check
  out end to end, with per-order pages and email confirmations.
- **Journal CMS** — a Tiptap rich-text editor with cover and inline image uploads
  pushed straight to S3-compatible object storage.
- **Admin back office** — dashboard, order management, subscriber list and a
  security center, all behind authenticated `/admin` routes.
- **Passwordless auth** — better-auth with passkeys (WebAuthn): register a
  hardware/biometric key and sign in without a password.
- **⌘K command palette** — Meilisearch-backed instant search across the back
  office, with the master key kept strictly server-side.
- **Optional Stripe checkout** — add live keys to charge real cards; leave them
  unset and the order flow runs in honest simulated-checkout mode.
- **Transactional email** — order and subscribe emails over SMTP, with a Mailpit
  catcher bundled so every message is visible in dev and stage.
- **One-import infrastructure** — PostgreSQL, object storage, Meilisearch and
  Mailpit come up together and are wired to the app by hostname, nothing to
  configure by hand.
<!-- #ZEROPS_EXTRACT_END:features# -->

<!-- #ZEROPS_EXTRACT_START:takeover-guide# -->
## Make it yours

ZRNO is meant to be adopted as a template. To run your own copy:

1. **Fork the repo** and push it to your own GitHub account.
   ```bash
   git clone https://github.com/fxck/zrno-coffee.git my-coffee-shop
   cd my-coffee-shop
   git remote set-url origin https://github.com/<you>/my-coffee-shop.git
   git push -u origin main
   ```
2. **Point the import at your fork.** In the env folder you deploy, edit each
   `buildFromGit:` URL to your repo (skip this if you deploy the canonical repo
   as-is).
3. **Deploy on Zerops.** Add a new project → *Import project* and paste the
   chosen environment's `import.yaml` (start with **Development** or **Stage**).
4. **Sign in to the back office.** `ADMIN_PASSWORD` is generated at import — read
   it from the project's env variables in the GUI, then open `/admin` and log in
   as `ADMIN_EMAIL`.
5. **Lock down your account.** At `/admin/security` change the admin email and
   password and register a **passkey** for passwordless sign-in.

> [!NOTE]
> Without `STRIPE_SECRET_KEY` the checkout runs in **simulated mode** — orders
> are recorded and confirmation emails sent, but no card is charged. This is the
> default so the recipe works on first deploy.

> [!WARNING]
> Any non-empty `STRIPE_SECRET_KEY` switches Stripe **on**. Never set a
> placeholder value — an invalid key makes real checkout fail. Leave it unset to
> stay in simulated mode, or set a valid key plus `STRIPE_PUBLISHABLE_KEY`.

### Secrets

| Variable | State | What to do |
|---|---|---|
| `BETTER_AUTH_SECRET` | generated | Created at import; must match across services sharing the db. Leave it. |
| `ADMIN_EMAIL` | preset (`admin@zrno.cz`) | Change to your address after first login. |
| `ADMIN_PASSWORD` | generated | Read from the GUI env, then change it in `/admin/security`. |
| `STRIPE_SECRET_KEY` | optional / unset | Set a live key to enable real Stripe Checkout. |
| `STRIPE_PUBLISHABLE_KEY` | optional / unset | Set alongside the secret key when enabling Stripe. |
| `SMTP_*` | preset → Mailpit | Override `SMTP_HOST`/`SMTP_PORT`/credentials for real email. |
<!-- #ZEROPS_EXTRACT_END:takeover-guide# -->

<!-- #ZEROPS_EXTRACT_START:knowledge-base# -->
## Architecture

ZRNO is a single TanStack Start service (React 19 SSR via Vite + Nitro, Node.js
24) that serves both the storefront and a JSON API from file-based routes under
`src/routes`. It depends on four managed services, all addressed by hostname:

| Service | Type | Role |
|---|---|---|
| `db` | PostgreSQL | better-auth accounts, orders, subscribers, journal posts |
| `storage` | S3-compatible object storage | journal cover + inline images |
| `search` | Meilisearch | back-office ⌘K command-palette index |
| `mailpit` | Alpine + Mailpit | SMTP catcher + web UI for outgoing email |

The app is built once and runs `node .output/server/index.mjs` behind a `/`
health check. In the Development environment `appdev` idles (no supervised
`run.start`) so a coding agent owns the dev server, while `appstage` runs the
real production build.

## Environment variable reference

Wired automatically in `zerops.yaml` `run.envVariables` from service hostnames —
nothing to set by hand:

- `DATABASE_URL` ← `${db_connectionString}`
- `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` ←
  `storage_*`
- `MEILI_HOST` (`http://search:${search_port}`) / `MEILI_MASTER_KEY` ←
  `search_*` (server-side only — never sent to the browser)
- `SMTP_HOST` / `SMTP_PORT` / `EMAIL_FROM` / `EMAIL_PROVIDER` → Mailpit defaults

Set by the import (`project.envVariables`): `BETTER_AUTH_SECRET` (generated),
`ADMIN_EMAIL`, `ADMIN_PASSWORD` (generated). Optional: `STRIPE_SECRET_KEY`,
`STRIPE_PUBLISHABLE_KEY`.

## Troubleshooting

- **App boots but search/⌘K errors** — the `search` (Meilisearch) service must
  be present and reachable; it floors at `minRam: 1` to avoid OOM crash-loops.
- **Checkout says "simulated"** — that's expected with no `STRIPE_SECRET_KEY`.
  Add a valid live key plus `STRIPE_PUBLISHABLE_KEY` and restart the app.
- **No emails arriving** — in dev/stage they're caught by Mailpit; open its
  subdomain to read them. For real delivery override `SMTP_*`.
- **Admin login fails** — `ADMIN_PASSWORD` is generated at import; read the
  current value from the project env in the GUI.
<!-- #ZEROPS_EXTRACT_END:knowledge-base# -->
