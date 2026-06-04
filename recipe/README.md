# ZRNO — Zerops recipe

Deploy the ZRNO coffee-shop app (TanStack Start SSR · PostgreSQL · better-auth
with passkeys · object-storage image uploads · Mailpit · optional Stripe) to
Zerops in one import.

Three import variants live in this folder — pick the one that matches what you
want to spin up:

| File | What it creates | Plan |
|------|-----------------|------|
| [`ai-agent.yml`](./ai-agent.yml) | **dev + stage pair** (`appdev` idles for agent/SSHFS iteration, `appstage` runs the prod build) + `db` + `storage` + `mailpit` | Lightweight |
| [`stage.yml`](./stage.yml) | **single `app`** running the production build + `db` + `storage` + `mailpit` | Lightweight |
| [`prod.yml`](./prod.yml) | **production**: HA `db`, scaled 2–4 dedicated-CPU `app`, health-gated rolling deploys | Serious |

All three build the app from git via `buildFromGit` and select the right
`zerops.yaml` block via `zeropsSetup` (`dev` for the dev workspace, `prod`
everywhere else).

## Prerequisites

1. **Push this project to git.** The imports reference
   `https://github.com/fxck/pencil-zerops`. Push the repo there (or edit the
   `buildFromGit:` URL in each file to your fork). The repo must be reachable
   by Zerops at build time — public, or a private repo you've connected.
2. A Zerops account. `prod.yml` needs the **Serious** project plan (HA + multi
   container); the other two run on Lightweight.

## Import

In the Zerops GUI: **Add new project → Import project**, then paste the
contents of the chosen `*.yml` file. Services come up in priority order
(`db`/`storage`/`mailpit` first, then the app builds from git).

## What you get

- **Admin back office** at `/admin` — seeded from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD`. The password is generated at import; read it from the
  project's env vars in the GUI, then change it (and the email) at
  `/admin/security`, where you can also register **passkeys**.
- **Storefront** `/` with menu, cart, order checkout, journal, subscribe.
- **Mailpit** web UI (its subdomain) catches every outgoing email in
  dev/stage.

## Environment variables

Set automatically by the import (`project.envVariables`):

| Var | Source | Notes |
|-----|--------|-------|
| `BETTER_AUTH_SECRET` | generated | shared auth secret (must match across services sharing the db) |
| `ADMIN_EMAIL` | `admin@zrno.cz` | change it |
| `ADMIN_PASSWORD` | generated | read from GUI env, then change in `/admin/security` |

Cross-service wiring (`DATABASE_URL`, `S3_*`, `SMTP_*`) is resolved in
`zerops.yaml` `run.envVariables` from the `db` / `storage` / `mailpit`
hostnames — nothing to set by hand.

### Payments are optional

`STRIPE_SECRET_KEY` is intentionally **not** set. Without it the order flow
runs in **simulated-checkout mode** — orders are recorded and confirmation
emails sent, but no card is charged and the UI says so. To enable real Stripe
Checkout, add these to the project env (GUI) and restart the app:

```
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
```

> Do **not** put a placeholder/invalid value in `STRIPE_SECRET_KEY` — any
> non-empty value switches Stripe on, and an invalid key makes checkout fail.
> Leave it unset to stay in simulated mode.

### Production email

`prod.yml` ships Mailpit so the recipe works out of the box. For real email,
set `SMTP_HOST` / `SMTP_PORT` / credentials in the project env (overriding the
`zerops.yaml` defaults of `mailpit:1025`) and remove the `mailpit` service.

## Runtime

Node.js 24, Vite + Nitro SSR. The `dev` block idles (no `run.start`) so a
coding agent owns the dev server; the `prod` block runs
`node .output/server/index.mjs` behind a `/` health check.
