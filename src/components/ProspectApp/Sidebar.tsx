import { useState, useEffect, useCallback } from 'react';
import { Search, X, Settings } from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../lib/constants';
import { THEME } from '../../lib/site-config';
import type { AppState, Action, Company, Category, Status, Priority } from './types';
import FilterCheckbox from './FilterCheckbox';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  filteredCompanies: Company[];
}

export default function Sidebar({ state, dispatch, filteredCompanies }: Props) {
  const [searchInput, setSearchInput] = useState(state.filters.search);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'SET_FILTER_SEARCH', payload: searchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, dispatch]);

  const hasActiveFilters =
    state.filters.search !== '' ||
    state.filters.statuses.length > 0 ||
    state.filters.categories.length > 0 ||
    state.filters.priorities.length > 0 ||
    state.filters.hasEmail ||
    state.filters.hasContact ||
    state.filters.overdueOnly;

  // Count companies per status from unfiltered data
  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = state.companies.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  // Count companies per category
  const categoryCounts = state.categories.reduce((acc, cat) => {
    acc[cat.id] = state.companies.filter((c) => c.category_id === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <aside
      className="w-[280px] flex-shrink-0 h-full overflow-y-auto p-4 flex flex-col gap-5"
      style={{ backgroundColor: THEME.surface, borderRight: `1px solid ${THEME.border}` }}
    >
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: THEME.textMuted }} />
        <input
          type="text"
          placeholder="Search prospects..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 rounded-[10px] text-sm outline-none transition-all duration-200"
          style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(''); dispatch({ type: 'SET_FILTER_SEARCH', payload: '' }); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
            style={{ color: THEME.textMuted }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Status filters */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.textMuted }}>Status</h3>
        <div className="space-y-1">
          {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => (
            <FilterCheckbox
              key={key}
              label={cfg.label}
              color={cfg.color}
              shape="dot"
              count={statusCounts[key] || 0}
              checked={state.filters.statuses.includes(key)}
              onChange={() => dispatch({ type: 'TOGGLE_FILTER_STATUS', payload: key })}
            />
          ))}
        </div>
      </div>

      {/* Category filters */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.textMuted }}>Category</h3>
        <div className="space-y-1">
          {state.categories.map((cat) => (
            <FilterCheckbox
              key={cat.id}
              label={cat.name}
              color={cat.color}
              shape="square"
              count={categoryCounts[cat.id] || 0}
              checked={state.filters.categories.includes(cat.id)}
              onChange={() => dispatch({ type: 'TOGGLE_FILTER_CATEGORY', payload: cat.id })}
            />
          ))}
        </div>
      </div>

      {/* Priority filters */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.textMuted }}>Priority</h3>
        <div className="space-y-1">
          {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG[Priority]][]).map(([key, cfg]) => (
            <FilterCheckbox
              key={key}
              label={cfg.label}
              color={cfg.color}
              shape="dot"
              checked={state.filters.priorities.includes(key)}
              onChange={() => dispatch({ type: 'TOGGLE_FILTER_PRIORITY', payload: key })}
            />
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <button
          type="button"
          role="switch"
          aria-checked={state.filters.hasEmail}
          onClick={() => dispatch({ type: 'TOGGLE_HAS_EMAIL' })}
          className="flex items-center gap-2 cursor-pointer w-full text-left"
        >
          <div
            className="w-8 h-4 rounded-full relative transition-all duration-200 flex-shrink-0"
            style={{ backgroundColor: state.filters.hasEmail ? THEME.accent : THEME.border }}
          >
            <div
              className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all duration-200"
              style={{ left: state.filters.hasEmail ? '17px' : '2px' }}
            />
          </div>
          <span className="text-sm" style={{ color: THEME.textPrimary }}>Has email</span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={state.filters.hasContact}
          onClick={() => dispatch({ type: 'TOGGLE_HAS_CONTACT' })}
          className="flex items-center gap-2 cursor-pointer w-full text-left"
        >
          <div
            className="w-8 h-4 rounded-full relative transition-all duration-200 flex-shrink-0"
            style={{ backgroundColor: state.filters.hasContact ? THEME.accent : THEME.border }}
          >
            <div
              className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all duration-200"
              style={{ left: state.filters.hasContact ? '17px' : '2px' }}
            />
          </div>
          <span className="text-sm" style={{ color: THEME.textPrimary }}>Has contact</span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={state.filters.overdueOnly}
          onClick={() => dispatch({ type: 'TOGGLE_OVERDUE_ONLY' })}
          className="flex items-center gap-2 cursor-pointer w-full text-left"
        >
          <div
            className="w-8 h-4 rounded-full relative transition-all duration-200 flex-shrink-0"
            style={{ backgroundColor: state.filters.overdueOnly ? '#f97316' : THEME.border }}
          >
            <div
              className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all duration-200"
              style={{ left: state.filters.overdueOnly ? '17px' : '2px' }}
            />
          </div>
          <span className="text-sm" style={{ color: THEME.textPrimary }}>Overdue follow-up</span>
        </button>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={() => { dispatch({ type: 'CLEAR_FILTERS' }); setSearchInput(''); }}
          className="text-sm py-2 rounded-[6px] transition-all duration-200 cursor-pointer"
          style={{ color: THEME.accent }}
        >
          Clear all filters
        </button>
      )}

      {/* Manage Categories */}
      <button
        onClick={() => dispatch({ type: 'SET_CATEGORY_MANAGER', payload: true })}
        className="flex items-center gap-2 text-sm py-2 rounded-[6px] transition-all duration-200 cursor-pointer mt-auto"
        style={{ color: THEME.textSecondary }}
      >
        <Settings size={14} />
        Manage Categories
      </button>
    </aside>
  );
}
