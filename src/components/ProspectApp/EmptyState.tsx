import { Inbox, Search } from 'lucide-react';
import { THEME } from '../../lib/site-config';

interface Props {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export default function EmptyState({ hasFilters, onClearFilters }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
      {hasFilters ? (
        <>
          <Search size={48} style={{ color: THEME.textMuted }} className="mb-4" />
          <h3 className="text-lg font-semibold mb-2" style={{ color: THEME.textPrimary }}>
            No prospects match your filters
          </h3>
          <p className="text-sm mb-4" style={{ color: THEME.textSecondary }}>
            Try adjusting your filters or search terms.
          </p>
          {onClearFilters && (
            <button
              onClick={onClearFilters}
              className="px-4 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
            >
              Clear all filters
            </button>
          )}
        </>
      ) : (
        <>
          <Inbox size={48} style={{ color: THEME.textMuted }} className="mb-4" />
          <h3 className="text-lg font-semibold mb-2" style={{ color: THEME.textPrimary }}>
            No prospects yet
          </h3>
          <p className="text-sm" style={{ color: THEME.textSecondary }}>
            Import some data to get started.
          </p>
        </>
      )}
    </div>
  );
}
