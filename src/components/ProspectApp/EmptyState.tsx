import { Inbox, Search } from 'lucide-react';

interface Props {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export default function EmptyState({ hasFilters, onClearFilters }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
      {hasFilters ? (
        <>
          <Search size={48} style={{ color: '#5c6280' }} className="mb-4" />
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#e8eaf4' }}>
            No prospects match your filters
          </h3>
          <p className="text-sm mb-4" style={{ color: '#8990b0' }}>
            Try adjusting your filters or search terms.
          </p>
          {onClearFilters && (
            <button
              onClick={onClearFilters}
              className="px-4 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: '#818cf8', color: '#fff' }}
            >
              Clear all filters
            </button>
          )}
        </>
      ) : (
        <>
          <Inbox size={48} style={{ color: '#5c6280' }} className="mb-4" />
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#e8eaf4' }}>
            No prospects yet
          </h3>
          <p className="text-sm" style={{ color: '#8990b0' }}>
            Import some data to get started.
          </p>
        </>
      )}
    </div>
  );
}
