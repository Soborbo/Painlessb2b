import { MapPin, List, Columns3, Flame, Bell, Plus, LogOut, BarChart3, Copy, FileText, History } from 'lucide-react';
import { STATUS_CONFIG } from '../../lib/constants';
import { THEME, SITE_CONFIG } from '../../lib/site-config';
import type { AppState, Action, Company, View } from './types';
import ImportExport from './ImportExport';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  filteredCompanies: Company[];
  onRefresh: () => void;
  onOpenDuplicates: () => void;
  onOpenTemplates: () => void;
  onOpenActivityLog: () => void;
}

const VIEW_OPTIONS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: 'map', label: 'Map', icon: <MapPin size={16} /> },
  { key: 'list', label: 'List', icon: <List size={16} /> },
  { key: 'kanban', label: 'Kanban', icon: <Columns3 size={16} /> },
  { key: 'heatmap', label: 'Heatmap', icon: <Flame size={16} /> },
  { key: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} /> },
];

export default function TopBar({ state, dispatch, filteredCompanies, onRefresh, onOpenDuplicates, onOpenTemplates, onOpenActivityLog }: Props) {
  const total = state.companies.length;
  const newCount = state.companies.filter((c) => c.status === 'new').length;
  const inProgress = state.companies.filter((c) =>
    ['contacted', 'follow_up', 'in_conversation'].includes(c.status)
  ).length;
  const partners = state.companies.filter((c) => c.status === 'partner').length;
  const rejected = state.companies.filter((c) =>
    ['rejected', 'not_interested'].includes(c.status)
  ).length;

  const statChips = [
    { label: 'Total', count: total, color: THEME.accent, filterStatuses: null },
    { label: 'New', count: newCount, color: STATUS_CONFIG.new.color, filterStatuses: ['new'] },
    { label: 'In Progress', count: inProgress, color: STATUS_CONFIG.contacted.color, filterStatuses: ['contacted', 'follow_up', 'in_conversation'] },
    { label: 'Partners', count: partners, color: STATUS_CONFIG.partner.color, filterStatuses: ['partner'] },
    { label: 'Rejected', count: rejected, color: STATUS_CONFIG.rejected.color, filterStatuses: ['rejected', 'not_interested'] },
  ];

  const handleChipClick = (filterStatuses: string[] | null) => {
    if (filterStatuses === null) {
      dispatch({ type: 'SET_FILTER_STATUSES', payload: [] });
    } else {
      dispatch({ type: 'SET_FILTER_STATUSES', payload: filterStatuses });
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <header
      className="flex items-center gap-4 px-4 py-2 h-[56px]"
      style={{ backgroundColor: THEME.surface, borderBottom: `1px solid ${THEME.border}` }}
    >
      {/* Left: App name */}
      <div className="flex items-center gap-2 mr-4">
        <MapPin size={20} style={{ color: THEME.accent }} />
        <span className="font-semibold text-sm whitespace-nowrap" style={{ color: THEME.textPrimary }}>
          {SITE_CONFIG.name}
        </span>
      </div>

      {/* Centre: Stat chips */}
      <div className="flex items-center gap-2 flex-1 justify-center">
        {statChips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => handleChipClick(chip.filterStatuses)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer"
            style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chip.color }} />
            <span>{chip.label}</span>
            <span className="font-mono" style={{ color: THEME.textSecondary }}>{chip.count}</span>
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* View toggle */}
        <div className="flex items-center rounded-[6px] overflow-hidden" style={{ border: `1px solid ${THEME.border}` }}>
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: opt.key })}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: state.view === opt.key ? THEME.accent : 'transparent',
                color: state.view === opt.key ? THEME.accentForeground : THEME.textSecondary,
              }}
            >
              {opt.icon}
              <span className="hidden xl:inline">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Reminder badge */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_OVERDUE_ONLY' })}
          className="relative p-2 rounded-[6px] transition-all duration-200 cursor-pointer"
          style={{ color: state.overdueCount > 0 ? '#f97316' : THEME.textSecondary }}
          title="Overdue follow-ups"
        >
          <Bell size={18} />
          {state.overdueCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-mono font-bold flex items-center justify-center"
              style={{ backgroundColor: '#ef4444', color: THEME.accentForeground }}
            >
              {state.overdueCount > 9 ? '9+' : state.overdueCount}
            </span>
          )}
        </button>

        {/* Activity log */}
        <button
          onClick={onOpenActivityLog}
          className="p-2 rounded-[6px] transition-all duration-200 cursor-pointer"
          style={{ color: THEME.textSecondary }}
          title="Activity Log"
        >
          <History size={18} />
        </button>

        {/* Duplicate detector */}
        <button
          onClick={onOpenDuplicates}
          className="p-2 rounded-[6px] transition-all duration-200 cursor-pointer"
          style={{ color: THEME.textSecondary }}
          title="Find Duplicates"
        >
          <Copy size={18} />
        </button>

        {/* Template manager */}
        <button
          onClick={onOpenTemplates}
          className="p-2 rounded-[6px] transition-all duration-200 cursor-pointer"
          style={{ color: THEME.textSecondary }}
          title="Email Templates"
        >
          <FileText size={18} />
        </button>

        <ImportExport
          onImportComplete={(result) => {
            dispatch({
              type: 'SET_TOAST',
              payload: { message: `Imported ${result.imported} prospects, ${result.skipped} skipped`, type: 'success' },
            });
            onRefresh();
          }}
          onError={(msg) => dispatch({ type: 'SET_TOAST', payload: { message: msg, type: 'error' } })}
        />

        {/* Add prospect */}
        <button
          onClick={() => {
            dispatch({ type: 'SET_DRAWER_MODE', payload: 'create' });
            dispatch({ type: 'SET_SELECTED_COMPANY', payload: 'new' });
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all duration-200 cursor-pointer"
          style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
        >
          <Plus size={14} />
          Add
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-[6px] transition-all duration-200 cursor-pointer"
          style={{ color: THEME.textSecondary }}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
