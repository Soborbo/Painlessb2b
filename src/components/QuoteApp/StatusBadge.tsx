import type { QuoteStatus } from '../../quotes/types';

const STYLES: Record<QuoteStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: 'bg-gray-100', fg: 'text-gray-700' },
  sent: { label: 'Sent', bg: 'bg-blue-100', fg: 'text-blue-800' },
  opened: { label: 'Opened', bg: 'bg-indigo-100', fg: 'text-indigo-800' },
  clicked: { label: 'Clicked', bg: 'bg-violet-100', fg: 'text-violet-800' },
  replied: { label: 'Replied', bg: 'bg-amber-100', fg: 'text-amber-800' },
  won: { label: 'Won', bg: 'bg-emerald-100', fg: 'text-emerald-800' },
  lost: { label: 'Lost', bg: 'bg-rose-100', fg: 'text-rose-800' },
  expired: { label: 'Expired', bg: 'bg-gray-200', fg: 'text-gray-600' },
};

export default function StatusBadge({ status }: { status: QuoteStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}
