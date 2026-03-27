import { useState, useEffect } from 'react';
import { X, Send, ChevronDown, Loader2 } from 'lucide-react';
import { EMAIL_TEMPLATES, TEMPLATE_NAMES } from '../../lib/email-templates';
import type { Company, EmailLog } from './types';
import type { TemplateName } from '../../lib/email-templates';

interface Props {
  company: Company;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export default function EmailModal({ company, open, onClose, onSent, onToast }: Props) {
  const [template, setTemplate] = useState<TemplateName>('intro');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [emailLog, setEmailLog] = useState<EmailLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Init fields from template
  useEffect(() => {
    if (!open) return;
    const to = company.contact_email || company.generic_email || '';
    setToEmail(to);
    applyTemplate('intro');
    // Fetch email history
    fetch(`/api/email/log/${company.id}`)
      .then((r) => r.json())
      .then(setEmailLog)
      .catch(() => {});
  }, [open, company.id]);

  const applyTemplate = (name: TemplateName) => {
    setTemplate(name);
    const tmpl = EMAIL_TEMPLATES[name].generate({
      companyName: company.name,
      contactName: company.contact_name || '',
    });
    setSubject(tmpl.subject);
    setBody(tmpl.body);
  };

  const handleSend = async () => {
    if (!toEmail) {
      onToast('Recipient email is required', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          to_email: toEmail,
          subject,
          body,
        }),
      });
      if (res.ok) {
        onToast('Email sent', 'success');
        onSent();
        onClose();
      } else {
        const err = await res.json();
        onToast(err.error || 'Failed to send email', 'error');
      }
    } catch {
      onToast('Failed to send email', 'error');
    }
    setSending(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-[14px] p-6 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#13151e', border: '1px solid #2a2d42' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: '#e8eaf4' }}>Send Email</h2>
          <button onClick={onClose} className="p-1 cursor-pointer" style={{ color: '#8990b0' }}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Template selector */}
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#5c6280' }}>Template</label>
            <select
              value={template}
              onChange={(e) => applyTemplate(e.target.value as TemplateName)}
              className="w-full px-3 py-2 rounded-[6px] text-sm outline-none cursor-pointer"
              style={{ backgroundColor: '#1a1d2a', border: '1px solid #2a2d42', color: '#e8eaf4' }}
            >
              {TEMPLATE_NAMES.map((name) => (
                <option key={name} value={name}>{EMAIL_TEMPLATES[name].label}</option>
              ))}
            </select>
          </div>

          {/* To */}
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#5c6280' }}>To</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] text-sm outline-none"
              style={{ backgroundColor: '#1a1d2a', border: '1px solid #2a2d42', color: '#e8eaf4' }}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#5c6280' }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] text-sm outline-none"
              style={{ backgroundColor: '#1a1d2a', border: '1px solid #2a2d42', color: '#e8eaf4' }}
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#5c6280' }}>Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 rounded-[6px] text-sm outline-none resize-none"
              style={{ backgroundColor: '#1a1d2a', border: '1px solid #2a2d42', color: '#e8eaf4' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: '#818cf8', color: '#fff' }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>

        {/* Email history */}
        {emailLog.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2a2d42' }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider cursor-pointer"
              style={{ color: '#5c6280' }}
            >
              <ChevronDown size={14} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              Email History ({emailLog.length})
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2">
                {emailLog.map((log) => (
                  <div
                    key={log.id}
                    className="px-3 py-2 rounded-[6px] text-sm"
                    style={{ backgroundColor: '#1a1d2a' }}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ color: '#e8eaf4' }}>{log.subject}</span>
                      <span
                        className="text-xs"
                        style={{ color: log.status === 'sent' ? '#10b981' : '#ef4444' }}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#5c6280' }}>
                      To: {log.to_email} · {new Date(log.sent_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
