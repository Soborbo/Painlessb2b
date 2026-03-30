import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { THEME } from '../../lib/site-config';
import { formatRelativeTime } from '../../lib/utils';
import type { ActivityLogEntry } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  companyId?: string | null;
  onSelectCompany?: (id: string) => void;
}

export default function ActivityLog({ open, onClose, companyId, onSelectCompany }: Props) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchEntries = async (reset = false) => {
    const newOffset = reset ? 0 : offset;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30', offset: String(newOffset) });
      if (companyId) params.set('company_id', companyId);
      const res = await fetch(`/api/activity-log?${params}`);
      const data: ActivityLogEntry[] = await res.json();
      if (reset) {
        setEntries(data);
      } else {
        setEntries((prev) => [...prev, ...data]);
      }
      setOffset(newOffset + data.length);
      setHasMore(data.length === 30);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setOffset(0);
    fetchEntries(true);
  }, [open, companyId]);

  if (!open) return null;

  const actionLabels: Record<string, string> = {
    status_changed: 'Status changed',
    category_changed: 'Category changed',
    priority_changed: 'Priority changed',
    company_created: 'Prospect created',
    company_updated: 'Prospect updated',
    company_deleted: 'Prospect deleted',
    email_sent: 'Email sent',
    note_added: 'Note added',
    imported: 'Bulk import',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" data-modal-overlay>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-[14px] p-6 max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: THEME.textPrimary }}>
            Activity Log
          </h2>
          <button onClick={onClose} className="p-1 cursor-pointer" style={{ color: THEME.textSecondary }}>
            <X size={20} />
          </button>
        </div>

        {entries.length === 0 && !loading && (
          <p className="text-sm text-center py-8" style={{ color: THEME.textMuted }}>
            No activity recorded yet.
          </p>
        )}

        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 py-2.5"
              style={{ borderBottom: `1px solid ${THEME.border}` }}
            >
              <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: THEME.accent }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: THEME.textPrimary }}>
                    {actionLabels[entry.action] || entry.action.replace(/_/g, ' ')}
                  </span>
                </div>
                {entry.company_name && (
                  <button
                    onClick={() => { if (onSelectCompany && entry.company_id) { onClose(); onSelectCompany(entry.company_id); } }}
                    className="text-xs cursor-pointer hover:underline"
                    style={{ color: THEME.accent }}
                  >
                    {entry.company_name}
                  </button>
                )}
                {entry.details && (
                  <p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>{entry.details}</p>
                )}
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: THEME.textMuted }}>
                {formatRelativeTime(entry.created_at)}
              </span>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin" style={{ color: THEME.textMuted }} />
          </div>
        )}

        {hasMore && !loading && entries.length > 0 && (
          <button
            onClick={() => fetchEntries(false)}
            className="w-full py-2 mt-2 text-xs font-medium rounded-[6px] cursor-pointer"
            style={{ backgroundColor: THEME.elevated, color: THEME.textSecondary }}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
