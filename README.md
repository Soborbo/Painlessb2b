# Painlessb2b

Astro + React SPA for B2B prospect tracking, deployed to Cloudflare Workers
with a D1 database.

## Deploying to Cloudflare Workers

One-time setup:

1. **Install deps**: `npm install`
2. **Log in to Wrangler**: `npx wrangler login`
3. **Create the session KV namespace** (Astro's SSR session store requires
   a KV binding, even though app code doesn't use `Astro.session`):
   ```
   npx wrangler kv namespace create SESSION
   ```
   Paste the printed `id` into `wrangler.toml` under `[[kv_namespaces]]`,
   replacing `REPLACE_WITH_KV_NAMESPACE_ID`.
4. **Set secrets** — each one prompts for a value:
   ```
   npx wrangler secret put AUTH_PASSWORD
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put GOOGLE_MAPS_API_KEY
   npx wrangler secret put RESEND_API_KEY
   ```
   Optional plain variables (for outgoing email):
   ```
   npx wrangler secret put SENDER_EMAIL   # or set in [vars] in wrangler.toml
   npx wrangler secret put SENDER_NAME
   ```
5. **Deploy**:
   ```
   npm run deploy
   ```
   This runs `astro build` and then
   `wrangler deploy -c ./dist/server/wrangler.json` (the adapter-generated
   config that includes `main`, `assets`, and the bindings inherited from
   the root `wrangler.toml`).

## Local development

```
npm run dev
```

Bindings defined in `wrangler.toml` (D1, KV) are available through the
Astro Cloudflare adapter's `platformProxy`. Secrets for local dev go in
a `.dev.vars` file (gitignored):

```
AUTH_PASSWORD=dev
SESSION_SECRET=local-dev-secret
GOOGLE_MAPS_API_KEY=...
RESEND_API_KEY=...
```

## Database migrations

Schema lives in `schema.sql`. One-off migrations live in `scripts/*.sql`
and are run via the Cloudflare D1 console or:

```
npx wrangler d1 execute b2bpainless --remote --file=./scripts/<file>.sql
```
