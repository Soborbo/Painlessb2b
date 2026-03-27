/// <reference path="../.astro/types.d.ts" />

type D1Database = import('@cloudflare/workers-types').D1Database;

interface Env {
  DB: D1Database;
  AUTH_PASSWORD: string;
  SESSION_SECRET: string;
  RESEND_API_KEY: string;
  SENDER_EMAIL: string;
  SENDER_NAME: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
