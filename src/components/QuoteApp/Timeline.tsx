import { useMemo } from 'react';
import type { QuoteEvent, QuoteEventType } from '../../quotes/types';

interface Props {
  events: QuoteEvent[];
}

interface TimelineRow {
  type: QuoteEventType;
  primaryAt: string;
  count: number;
  payload: Record<string, unknown> | null;
}

const ICON: Record<QuoteEventType, string> = {
  created: '●',
  edited: '○',
  reset: '↺',
  sent: '✉',
  opened: '👁',
  clicked: '🔗',
  replied: '↩',
  status_changed: '→',
  bounced: '!',
  complained: '⚠',
};

const LABEL: Record<QuoteEventType, string> = {
  created: 'Created',
  edited: 'Edited',
  reset: 'Reset to defaults',
  sent: 'Sent',
  opened: 'Opened',
  clicked: 'Clicked link',
  replied: 'Replied',
  status_changed: 'Status changed',
  bounced: 'Bounced',
  complained: 'Marked spam',
};

export default function Timeline({ events }: Props) {
  const rows = useMemo(() => aggregateRuns(events), [events]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
        No timeline events yet.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {rows.map((row, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-0.5 w-4 text-center text-gray-400">{ICON[row.type]}</span>
          <div className="flex-1">
            <div className="text-sm">
              <span className="font-medium text-gray-900">{LABEL[row.type]}</span>
              {row.count > 1 && (
                <span className="ml-1 text-xs text-gray-500">×{row.count}</span>
              )}
              {detailLine(row)}
            </div>
            <div className="text-xs text-gray-500">{formatDateTime(row.primaryAt)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Collapse consecutive same-type events into one row with a count, so a
// drafting session with 30 edited events doesn't drown the timeline.
function aggregateRuns(events: QuoteEvent[]): TimelineRow[] {
  const out: TimelineRow[] = [];
  for (const ev of events) {
    const last = out[out.length - 1];
    if (last && last.type === ev.event_type && ev.event_type === 'edited') {
      last.count += 1;
      last.primaryAt = ev.occurred_at;
    } else {
      out.push({
        type: ev.event_type,
        primaryAt: ev.occurred_at,
        count: 1,
        payload: ev.payload,
      });
    }
  }
  return out;
}

function detailLine(row: TimelineRow): React.ReactNode {
  const p = row.payload;
  if (!p) return null;
  if (row.type === 'sent') {
    const to = typeof p.to === 'string' ? p.to : null;
    const alias = typeof p.from_alias === 'string' ? p.from_alias : null;
    if (to) {
      return (
        <span className="ml-1 text-xs text-gray-500">
          to {to}
          {alias ? ` from ${alias}@` : ''}
        </span>
      );
    }
  }
  if (row.type === 'clicked' && typeof p.url === 'string') {
    return <span className="ml-1 text-xs text-gray-500">→ {truncate(p.url, 60)}</span>;
  }
  if (row.type === 'clicked' && typeof p.click_url === 'string') {
    return (
      <span className="ml-1 text-xs text-gray-500">→ {truncate(p.click_url, 60)}</span>
    );
  }
  if (row.type === 'status_changed' && p.from && p.to && p.from !== p.to) {
    return (
      <span className="ml-1 text-xs text-gray-500">
        {String(p.from)} → {String(p.to)}
        {typeof p.deal_value_pence === 'number' && (
          <> (£{(p.deal_value_pence / 100).toFixed(2)})</>
        )}
      </span>
    );
  }
  return null;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function formatDateTime(iso: string): string {
  // D1 returns "YYYY-MM-DD HH:MM:SS" (UTC).
  const norm = iso.replace(' ', 'T') + 'Z';
  const d = new Date(norm);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
