import { useState } from 'react';
import { X, Trash2, Tag, Flag, ArrowRight } from 'lucide-react';
import { STATUS_CONFIG, STATUSES, PRIORITIES } from '../../lib/constants';
import { THEME } from '../../lib/site-config';
import type { Category } from './types';

interface Props {
  selectedCount: number;
  categories: Category[];
  onBulkAction: (action: string, value?: string) => Promise<void>;
  onClear: () => void;
}

export default function BulkActions({ selectedCount, categories, onBulkAction, onClear }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: string, value?: string) => {
    setLoading(true);
    await onBulkAction(action, value);
    setLoading(false);
    setShowStatusMenu(false);
    setShowCategoryMenu(false);
    setShowPriorityMenu(false);
    setConfirmDelete(false);
  };

  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-3 px-5 py-3 rounded-[14px] shadow-lg"
      style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
    >
      <span className="text-sm font-semibold" style={{ color: THEME.textPrimary }}>
        {selectedCount} selected
      </span>

      {/* Status change */}
      <div className="relative">
        <button
          onClick={() => { setShowStatusMenu(!showStatusMenu); setShowCategoryMenu(false); setShowPriorityMenu(false); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium cursor-pointer transition-colors"
          style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
        >
          <ArrowRight size={14} /> Status
        </button>
        {showStatusMenu && (
          <div className="absolute bottom-full left-0 mb-2 rounded-[6px] py-1 min-w-[160px] shadow-lg" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleAction('update_status', s)}
                className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 cursor-pointer transition-colors"
                style={{ color: THEME.textPrimary }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_CONFIG[s].color }} />
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category change */}
      <div className="relative">
        <button
          onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowStatusMenu(false); setShowPriorityMenu(false); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium cursor-pointer transition-colors"
          style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
        >
          <Tag size={14} /> Category
        </button>
        {showCategoryMenu && (
          <div className="absolute bottom-full left-0 mb-2 rounded-[6px] py-1 min-w-[160px] shadow-lg" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleAction('update_category', cat.id)}
                className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 cursor-pointer transition-colors"
                style={{ color: THEME.textPrimary }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Priority change */}
      <div className="relative">
        <button
          onClick={() => { setShowPriorityMenu(!showPriorityMenu); setShowStatusMenu(false); setShowCategoryMenu(false); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium cursor-pointer transition-colors"
          style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
        >
          <Flag size={14} /> Priority
        </button>
        {showPriorityMenu && (
          <div className="absolute bottom-full left-0 mb-2 rounded-[6px] py-1 min-w-[120px] shadow-lg" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => handleAction('update_priority', p)}
                className="w-full text-left px-3 py-1.5 text-sm cursor-pointer capitalize"
                style={{ color: THEME.textPrimary }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => {
          if (confirmDelete) handleAction('delete');
          else setConfirmDelete(true);
        }}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium cursor-pointer transition-colors"
        style={{
          backgroundColor: confirmDelete ? '#ef4444' : THEME.elevated,
          border: `1px solid ${confirmDelete ? '#ef4444' : THEME.border}`,
          color: confirmDelete ? '#fff' : '#ef4444',
        }}
      >
        <Trash2 size={14} />
        {confirmDelete ? 'Confirm Delete' : 'Delete'}
      </button>

      {/* Clear selection */}
      <button
        onClick={onClear}
        className="p-1.5 rounded-[6px] cursor-pointer transition-colors"
        style={{ color: THEME.textSecondary }}
        title="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  );
}
