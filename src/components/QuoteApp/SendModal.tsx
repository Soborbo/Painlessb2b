import { useEffect, useMemo, useState } from 'react';
import type { Quote, TemplateMeta, SenderAlias } from '../../quotes/types';
import { SENDER_ALIASES } from '../../quotes/types';

interface Props {
  quote: Quote;
  template: TemplateMeta;
  onClose: () => void;
  onSent: (updated: Quote) => void;
}

const SENDER_LABELS: Record<SenderAlias, string> = {
  jay: 'Jay <jay@painlessremovals.com>',
  richard: 'Richard <richard@painlessremovals.com>',
  quotes: 'Painless Removals <quotes@painlessremovals.com>',
  hello: 'Painless Removals <hello@painlessremovals.com>',
};

export default function SendModal({ quote, template, onClose, onSent }: Props) {
  const [to, setTo] = useState(quote.recipient_email ?? '');
  const [recipientName, setRecipientName] = useState(quote.recipient_name ?? '');
  const [alias, setAlias] = useState<SenderAlias>(quote.sender_alias ?? 'quotes');
  const [subject, setSubject] = useState(quote.subject ?? template.default_subject);
  const [messageBody, setMessageBody] = useState(
    quote.message_body ?? template.default_body
  );
  const [ccMe, setCcMe] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(quote.tracking_enabled);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSrc = useMemo(
    () => `/api/quotes/${quote.id}/preview-pdf#toolbar=0`,
    [quote.id]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const canSend = !!to && !sending;

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          recipient_name: recipientName || null,
          from_alias: alias,
          subject,
          message_body: messageBody,
          cc_me: ccMe,
          tracking_enabled: trackingEnabled,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.detail || json.error || `Send failed (HTTP ${res.status})`);
        setSending(false);
        return;
      }
      onSent(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold">Send quote</h2>
          <button
            onClick={onClose}
            disabled={sending}
            className="text-2xl leading-none text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[440px] space-y-3 overflow-y-auto border-r border-gray-200 p-6">
            <Field label="To">
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </Field>
            <Field label="Recipient name (optional)">
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="First Last — used in {{recipient_first_name}}"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </Field>
            <Field label="From">
              <select
                value={alias}
                onChange={(e) => setAlias(e.target.value as SenderAlias)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {(SENDER_ALIASES as readonly SenderAlias[]).map((a) => (
                  <option key={a} value={a}>
                    {SENDER_LABELS[a]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subject">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </Field>
            <Field label="Message">
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={7}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-gray-500">
                Placeholders available: <code>{'{{recipient_first_name}}'}</code>,{' '}
                <code>{'{{sender_name}}'}</code>, and any template field.
              </p>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ccMe}
                onChange={(e) => setCcMe(e.target.checked)}
              />
              CC me on this send
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={trackingEnabled}
                onChange={(e) => setTrackingEnabled(e.target.checked)}
              />
              Track opens and clicks
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col bg-gray-100">
            <div className="border-b border-gray-200 bg-white px-4 py-2 text-xs text-gray-500">
              PDF preview (this is what the recipient receives)
            </div>
            <iframe
              src={previewSrc}
              title="PDF preview"
              className="flex-1 border-0 bg-white"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send →'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-700">{label}</div>
      {children}
    </div>
  );
}
