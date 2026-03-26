import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: 'passthrough',
  }),
  // Use memory driver to prevent the adapter from adding a KV SESSION binding
  // (we use our own HMAC cookie auth, not Astro sessions)
  session: {
    driver: 'memory',
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['node:crypto'],
    },
  },
});
