import type { APIRoute } from 'astro';
import { listTemplates, getTemplateMeta } from '../../../quotes/templates';

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (id) {
    const meta = getTemplateMeta(id);
    if (!meta) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(meta), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ templates: listTemplates() }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
