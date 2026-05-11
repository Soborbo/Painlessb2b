import { useEffect, useState, useCallback } from 'react';
import { FileText, Plus, ExternalLink } from 'lucide-react';
import { THEME } from '../../lib/site-config';
import type { Quote, QuoteStatus } from '../../quotes/types';

interface Props {
  companyId: string;
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  opened: 'Opened',
  clicked: 'Clicked',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
  expired: 'Expired',
};

// Status pill backgrounds tuned to the warm CRM palette so they sit next
// to ContactsSection's primary-star and NoteTimeline avatars without
// looking like a Tailwind escapee.
const STATUS_TONE: Record<QuoteStatus, { bg: string; fg: string }> = {
  draft:   { bg: '#e7e3dc', fg: '#5a6070' },
  sent:    { bg: '#d9e6f2', fg: '#1c4868' },
  opened:  { bg: '#dde3f5', fg: '#2d3d80' },
  clicked: { bg: '#e7ddf5', fg: '#4b2b7a' },
  replied: { bg: '#f5e6c8', fg: '#7a5a1a' },
  won:     { bg: '#d3ead7', fg: '#1f5a30' },
  lost:    { bg: '#f1d6d6', fg: '#7a2828' },
  expired: { bg: '#d9d6d0', fg: '#6a6a6a' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  if (isNaN(t)) return iso;
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtMoney(pence: number | null): string | null {
  if (pence === null) return null;
  return '£' + (pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DrawerQuotes({ companyId }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes?company_id=${encodeURIComponent(companyId)}`);
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j.quotes)) setQuotes(j.quotes);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const newQuoteHref = `/quotes/new?company_id=${encodeURIComponent(companyId)}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
          Quotes
        </h3>
        <a
          href={newQuoteHref}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-[4px] transition-colors duration-150"
          style={{ color: THEME.accent, border: `1px solid ${THEME.border}` }}
          title="Start a new quote for this company"
        >
          <Plus size={12} />
          New
        </a>
      </div>

      {loading ? (
        <div className="text-xs" style={{ color: THEME.textMuted }}>Loading…</div>
      ) : quotes.length === 0 ? (
        <div
          className="rounded-[6px] p-3 text-xs text-center"
          style={{ backgroundColor: THEME.elevated, color: THEME.textMuted }}
        >
          No quotes yet for this company.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {quotes.map((q) => {
            const tone = STATUS_TONE[q.status];
            const href = q.status === 'draft' ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`;
            const deal = fmtMoney(q.deal_value_pence);
            return (
              <li key={q.id}>
                <a
                  href={href}
                  className="block rounded-[6px] p-2.5 transition-colors duration-150"
                  style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} style={{ color: THEME.textMuted, flexShrink: 0 }} />
                      <span
                        className="text-xs font-medium truncate"
                        style={{ color: THEME.textPrimary }}
                      >
                        {q.recipient_email ?? 'No recipient'}
                      </span>
                    </div>
                    <span
                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0"
                      style={{ backgroundColor: tone.bg, color: tone.fg }}
                    >
                      {STATUS_LABELS[q.status]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: THEME.textMuted }}>
                    <span>{timeAgo(q.last_activity_at ?? q.updated_at)}</span>
                    <span className="flex items-center gap-2">
                      {deal && <span style={{ color: THEME.textSecondary }}>{deal}</span>}
                      <ExternalLink size={10} />
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
