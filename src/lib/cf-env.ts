/**
 * Helper to access Cloudflare Workers env bindings.
 * Uses dynamic import to avoid top-level import issues with miniflare on Windows.
 * Note: env is fetched fresh each time to avoid stale DB connections across requests.
 */
export async function getCfEnv(): Promise<Record<string, any>> {
  const mod = await import('cloudflare:workers');
  return mod.env as any;
}
