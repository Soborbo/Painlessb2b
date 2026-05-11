/// <reference path="../.astro/types.d.ts" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type R2Bucket = import('@cloudflare/workers-types').R2Bucket;
type Fetcher = import('@cloudflare/workers-types').Fetcher;

interface Env {
  DB: D1Database;
  AUTH_PASSWORD: string;
  SESSION_SECRET: string;
  RESEND_API_KEY: string;
  SENDER_EMAIL: string;
  SENDER_NAME: string;
  // Quote tool bindings — wired up in later milestones once Workers Paid
  // plan + R2 bucket are confirmed. Optional so existing code doesn't
  // break while bindings are absent.
  QUOTE_PDFS?: R2Bucket;
  BROWSER?: Fetcher;
  RESEND_WEBHOOK_SECRET?: string;
  // Optional override for the "CC me" send-modal toggle. Defaults to the
  // selected sender alias address when unset.
  QUOTE_CC_EMAIL?: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
