import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { THEME } from '../../lib/site-config';

interface DuplicatePair {
  a: { id: string; name: string; postcode: string | null; address: string | null };
  b: { id: string; name: string; postcode: string | null; address: string | null };
  score: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectCompany: (id: string) => void;
  onDeleteCompany: (id: string) => Promise<void>;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export default function DuplicateDetector({ open, onClose, onSelectCompany, onDeleteCompany, onToast }: Props) {
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(0.7);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/duplicates?threshold=${threshold}`)
      .then((r) => r.json())
      .then((data) => { setDuplicates(data); setLoading(false); })
      .catch(() => { setLoading(false); onToast('Failed to check duplicates', 'error'); });
  }, [open, threshold]);

  const handleDelete = async (id: string) => {
    await onDeleteCompany(id);
    setDuplicates((prev) => prev.filter((d) => d.a.id !== id && d.b.id !== id));
    onToast('Duplicate removed', 'success');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" data-modal-overlay>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-[14px] p-6 max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
            <h2 className="text-lg font-semibold" style={{ color: THEME.textPrimary }}>Duplicate Detection</h2>
          </div>
          <button onClick={onClose} className="p-1 cursor-pointer" style={{ color: THEME.textSecondary }}>
            <X size={20} />
          </button>
        </div>

        {/* Threshold slider */}
        <div className="mb-4 flex items-center gap-3">
          <label className="text-xs" style={{ color: THEME.textMuted }}>Sensitivity:</label>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs font-mono w-8" style={{ color: THEME.textPrimary }}>{Math.round(threshold * 100)}%</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: THEME.textMuted }} />
          </div>
        ) : duplicates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: THEME.textSecondary }}>No duplicates found at this sensitivity level.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: THEME.textMuted }}>
              Found {duplicates.length} potential duplicate pair{duplicates.length !== 1 ? 's' : ''}
            </p>
            {duplicates.map((pair, idx) => (
              <div
                key={idx}
                className="rounded-[6px] p-3"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>
                    {Math.round(pair.score * 100)}% match
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DuplicateCard
                    item={pair.a}
                    onView={() => { onClose(); onSelectCompany(pair.a.id); }}
                    onDelete={() => handleDelete(pair.a.id)}
                  />
                  <DuplicateCard
                    item={pair.b}
                    onView={() => { onClose(); onSelectCompany(pair.b.id); }}
                    onDelete={() => handleDelete(pair.b.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DuplicateCard({ item, onView, onDelete }: {
  item: { id: string; name: string; postcode: string | null; address: string | null };
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-[6px] p-2" style={{ backgroundColor: THEME.surface }}>
      <p className="text-sm font-medium" style={{ color: THEME.textPrimary }}>{item.name}</p>
      {item.address && <p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>{item.address}</p>}
      {item.postcode && <p className="text-xs" style={{ color: THEME.textMuted }}>{item.postcode}</p>}
      <div className="flex gap-2 mt-2">
        <button
          onClick={onView}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{ backgroundColor: THEME.accent + '20', color: THEME.accent }}
        >
          View
        </button>
        <button
          onClick={onDelete}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
