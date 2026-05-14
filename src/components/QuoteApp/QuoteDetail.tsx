import { useCallback, useEffect, useState } from 'react';
import type { Quote, QuoteEvent, QuoteStatus, TemplateMeta } from '../../quotes/types';
import StatusBadge from './StatusBadge';
import Timeline from './Timeline';

interface Props {
  quote: Quote;
  template: TemplateMeta;
  events: QuoteEvent[];
}

const MANUAL_ACTIONS: { status: QuoteStatus; label: string; tone: string }[] = [
  { status: 'replied', label: 'Replied', tone: 'border-amber-300 text-amber-900 hover:bg-amber-50' },
  { status: 'won', label: 'Won (£…)', tone: 'border-emerald-300 text-emerald-900 hover:bg-emerald-50' },
  { status: 'lost', label: 'Lost', tone: 'border-rose-300 text-rose-900 hover:bg-rose-50' },
  { status: 'expired', label: 'Expired', tone: 'border-gray-300 text-gray-700 hover:bg-gray-50' },
];

export default function QuoteDetail({
  quote: initialQuote,
  template,
  events: initialEvents,
}: Props) {
  const [quote, setQuote] = useState(initialQuote);
  const [events, setEvents] = useState(initialEvents);
  const [pending, setPending] = useState<QuoteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${quote.id}/events`);
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j.events)) setEvents(j.events);
      }
    } catch {
      // best-effort
    }
  }, [quote.id]);

  const setStatus = useCallback(
    async (target: QuoteStatus) => {
      setError(null);
      let dealValuePence: number | null = null;
      let reason: string | null = null;

      if (target === 'won') {
        const raw = window.prompt('Deal value (£) — e.g. 1850 or 1850.50');
        if (raw === null) return;
        const trimmed = raw.trim().replace(/^£/, '').replace(/,/g, '');
        const pounds = Number(trimmed);
        if (!Number.isFinite(pounds) || pounds < 0) {
          setError('Invalid amount');
          return;
        }
        dealValuePence = Math.round(pounds * 100);
      } else if (target === 'lost') {
        const r = window.prompt('Optional: short reason for lost (or leave blank)');
        if (r === null) return;
        reason = r.trim() || null;
      }

      setPending(target);
      try {
        const res = await fetch(`/api/quotes/${quote.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: target,
            deal_value_pence: dealValuePence,
            reason,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.detail || json.error || `Failed (HTTP ${res.status})`);
        } else {
          setQuote(json);
          await refetchEvents();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error');
      } finally {
        setPending(null);
      }
    },
    [quote.id, refetchEvents]
  );

  // Light polling so opens/clicks coming in via webhooks reflect without
  // a manual refresh while the operator is on this page.
  useEffect(() => {
    if (quote.status === 'won' || quote.status === 'lost' || quote.status === 'expired') {
      return; // terminal — no point polling
    }
    const t = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/quotes/${quote.id}`);
        if (res.ok) {
          const j = await res.json();
          if (j && typeof j === 'object') {
            setQuote(j);
          }
        }
        await refetchEvents();
      } catch {
        // ignore
      }
    }, 20_000);
    return () => window.clearInterval(t);
  }, [quote.id, quote.status, refetchEvents]);

  const dealValueDisplay =
    quote.deal_value_pence !== null
      ? '£' +
        (quote.deal_value_pence / 100).toLocaleString('en-GB', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <a href="/quotes" className="text-sm text-gray-500 hover:underline">
        ← Quotes
      </a>

      <header className="mt-3 mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{template.name}</h1>
            <StatusBadge status={quote.status} />
          </div>
          <div className="mt-1 text-sm text-gray-500">
            Quote #{quote.id.slice(0, 8)}
            {quote.recipient_email && <> · sent to {quote.recipient_email}</>}
            {dealValueDisplay && <> · {dealValueDisplay}</>}
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/quotes/${quote.id}/preview-pdf?download=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Download PDF
          </a>
        </div>
      </header>

      {quote.status !== 'draft' && (
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Mark outcome</h2>
          <div className="flex flex-wrap gap-2">
            {MANUAL_ACTIONS.map((a) => (
              <button
                key={a.status}
                onClick={() => setStatus(a.status)}
                disabled={pending !== null}
                className={`rounded-md border bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${a.tone}`}
              >
                {pending === a.status ? 'Saving…' : a.label}
              </button>
            ))}
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>
      )}

      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">Timeline</h2>
        <Timeline events={events} />
      </section>
    </main>
  );
}
