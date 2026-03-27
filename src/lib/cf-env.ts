/**
 * Helper to access Cloudflare Workers env bindings.
 * Uses dynamic import to avoid top-level import issues with miniflare on Windows.
 */
let _env: Record<string, any> | null = null;

export async function getCfEnv(): Promise<Record<string, any>> {
  if (!_env) {
    const mod = await import('cloudflare:workers');
    _env = mod.env as any;
  }
  return _env;
}
