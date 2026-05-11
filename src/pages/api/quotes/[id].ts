import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import {
  getQuote,
  updateQuote,
  recordEditedThrottled,
  deleteQuote,
} from '../../../quotes/db';
import { SENDER_ALIASES } from '../../../quotes/types';
import type { SenderAlias } from '../../../quotes/types';

export const GET: APIRoute = async ({ params }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const quote = await getQuote(cfEnv.DB, id);
  if (!quote) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(quote), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const patch: Parameters<typeof updateQuote>[2] = {};
  if (body.field_data && typeof body.field_data === 'object') {
    const fd: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.field_data)) {
      if (typeof k === 'string' && typeof v === 'string') fd[k] = v;
    }
    patch.field_data = fd;
  }
  if (body.recipient_email !== undefined) {
    patch.recipient_email = body.recipient_email === null ? null : String(body.recipient_email);
  }
  if (body.recipient_name !== undefined) {
    patch.recipient_name = body.recipient_name === null ? null : String(body.recipient_name);
  }
  if (body.sender_alias !== undefined) {
    const sa = body.sender_alias;
    if (sa === null) {
      patch.sender_alias = null;
    } else if (
      typeof sa === 'string' &&
      (SENDER_ALIASES as readonly string[]).includes(sa)
    ) {
      patch.sender_alias = sa as SenderAlias;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid sender_alias' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  if (body.subject !== undefined) {
    patch.subject = body.subject === null ? null : String(body.subject);
  }
  if (body.message_body !== undefined) {
    patch.message_body = body.message_body === null ? null : String(body.message_body);
  }
  if (body.tracking_enabled !== undefined) {
    patch.tracking_enabled = !!body.tracking_enabled;
  }

  const updated = await updateQuote(cfEnv.DB, id, patch);
  if (!updated) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  await recordEditedThrottled(cfEnv.DB, id);
  return new Response(JSON.stringify(updated), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const existing = await getQuote(cfEnv.DB, id);
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (existing.status !== 'draft') {
    return new Response(
      JSON.stringify({ error: 'Only draft quotes can be deleted' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }
  await deleteQuote(cfEnv.DB, id);
  return new Response(null, { status: 204 });
};
