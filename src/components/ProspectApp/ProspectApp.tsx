import { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
import { THEME } from '../../lib/site-config';
import type { AppState, Action, Company, Filters, SortBy, Status } from './types';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import MapView from './MapView';
import HeatmapView from './HeatmapView';
import ListView from './ListView';
import KanbanView from './KanbanView';
import DashboardView from './DashboardView';
import ListPanel from './ListPanel';
import DetailDrawer from './DetailDrawer';
import EmailModal from './EmailModal';
import Toast from './Toast';
import EmptyState from './EmptyState';
import CategoryManager from './CategoryManager';
import BulkActions from './BulkActions';
import DuplicateDetector from './DuplicateDetector';
import TemplateManager from './TemplateManager';
import ActivityLog from './ActivityLog';

const initialState: AppState = {
  companies: [],
  categories: [],
  filters: {
    search: '',
    statuses: [],
    categories: [],
    priorities: [],
    hasEmail: false,
    hasContact: false,
    overdueOnly: false,
  },
  view: 'map',
  heatmapMode: 'activity',
  selectedCompanyId: null,
  drawerMode: 'view',
  emailModalOpen: false,
  sortBy: 'updated',
  sortDir: 'desc',
  overdueCount: 0,
  isLoading: true,
  toast: null,
  categoryManagerOpen: false,
  selectedIds: new Set<string>(),
  bulkActionOpen: false,
};

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_COMPANIES':
      return { ...state, companies: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'UPDATE_COMPANY':
      return {
        ...state,
        companies: state.companies.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };
    case 'ADD_COMPANY':
      return { ...state, companies: [action.payload, ...state.companies] };
    case 'REMOVE_COMPANY':
      return {
        ...state,
        companies: state.companies.filter((c) => c.id !== action.payload),
        selectedCompanyId: state.selectedCompanyId === action.payload ? null : state.selectedCompanyId,
      };
    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] };
    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };
    case 'REMOVE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload),
      };
    case 'SET_FILTER_SEARCH':
      return { ...state, filters: { ...state.filters, search: action.payload } };
    case 'TOGGLE_FILTER_STATUS':
      return { ...state, filters: { ...state.filters, statuses: toggleInArray(state.filters.statuses, action.payload) } };
    case 'SET_FILTER_STATUSES':
      return { ...state, filters: { ...state.filters, statuses: action.payload } };
    case 'TOGGLE_FILTER_CATEGORY':
      return { ...state, filters: { ...state.filters, categories: toggleInArray(state.filters.categories, action.payload) } };
    case 'SET_FILTER_CATEGORIES':
      return { ...state, filters: { ...state.filters, categories: action.payload } };
    case 'TOGGLE_FILTER_PRIORITY':
      return { ...state, filters: { ...state.filters, priorities: toggleInArray(state.filters.priorities, action.payload) } };
    case 'SET_FILTER_PRIORITIES':
      return { ...state, filters: { ...state.filters, priorities: action.payload } };
    case 'TOGGLE_HAS_EMAIL':
      return { ...state, filters: { ...state.filters, hasEmail: !state.filters.hasEmail } };
    case 'TOGGLE_HAS_CONTACT':
      return { ...state, filters: { ...state.filters, hasContact: !state.filters.hasContact } };
    case 'TOGGLE_OVERDUE_ONLY':
      return { ...state, filters: { ...state.filters, overdueOnly: !state.filters.overdueOnly } };
    case 'CLEAR_FILTERS':
      return { ...state, filters: initialState.filters };
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'SET_HEATMAP_MODE':
      return { ...state, heatmapMode: action.payload };
    case 'SET_SELECTED_COMPANY':
      return { ...state, selectedCompanyId: action.payload };
    case 'SET_DRAWER_MODE':
      return { ...state, drawerMode: action.payload };
    case 'SET_EMAIL_MODAL':
      return { ...state, emailModalOpen: action.payload };
    case 'SET_SORT':
      return { ...state, sortBy: action.payload.by, sortDir: action.payload.dir };
    case 'TOGGLE_SORT':
      return { ...state, sortBy: action.payload, sortDir: state.sortBy === action.payload && state.sortDir === 'desc' ? 'asc' : 'desc' };
    case 'SET_OVERDUE_COUNT':
      return { ...state, overdueCount: action.payload };
    case 'SET_TOAST':
      return { ...state, toast: action.payload };
    case 'SET_CATEGORY_MANAGER':
      return { ...state, categoryManagerOpen: action.payload };
    case 'TOGGLE_SELECTED_ID': {
      const next = new Set(state.selectedIds);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, selectedIds: next };
    }
    case 'SET_SELECTED_IDS':
      return { ...state, selectedIds: action.payload };
    case 'CLEAR_SELECTED_IDS':
      return { ...state, selectedIds: new Set(), bulkActionOpen: false };
    case 'SET_BULK_ACTION':
      return { ...state, bulkActionOpen: action.payload };
    default:
      return state;
  }
}

function isOverdue(company: Company): boolean {
  if (!company.follow_up_date) return false;
  if (['partner', 'rejected', 'not_interested'].includes(company.status)) return false;
  return new Date(company.follow_up_date) <= new Date();
}

function applyFilters(companies: Company[], filters: Filters): Company[] {
  return companies.filter((c) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(c.status)) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(c.category_id || '')) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(c.priority)) return false;
    if (filters.hasEmail && !c.contact_email && !c.generic_email) return false;
    if (filters.hasContact && !c.contact_name) return false;
    if (filters.overdueOnly && !isOverdue(c)) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const searchable = [c.name, c.address, c.postcode, c.contact_name].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(s)) return false;
    }
    return true;
  });
}

export default function ProspectApp() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [activityLogOpen, setActivityLogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [companiesRes, categoriesRes, remindersRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/categories'),
        fetch('/api/reminders'),
      ]);

      if (!companiesRes.ok || !categoriesRes.ok || !remindersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const companies = await companiesRes.json();
      const categories = await categoriesRes.json();
      const reminders = await remindersRes.json();

      dispatch({ type: 'SET_COMPANIES', payload: companies });
      dispatch({ type: 'SET_CATEGORIES', payload: categories });
      dispatch({ type: 'SET_OVERDUE_COUNT', payload: reminders.length });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to load data', type: 'error' } });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCompanies = useMemo(
    () => applyFilters(state.companies, state.filters),
    [state.companies, state.filters]
  );

  const hasActiveFilters =
    state.filters.search !== '' ||
    state.filters.statuses.length > 0 ||
    state.filters.categories.length > 0 ||
    state.filters.priorities.length > 0 ||
    state.filters.hasEmail ||
    state.filters.hasContact ||
    state.filters.overdueOnly;

  // Category CRUD handlers
  const handleAddCategory = async (name: string, color: string) => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const cat = await res.json();
        dispatch({ type: 'ADD_CATEGORY', payload: { ...cat, company_count: 0 } });
        dispatch({ type: 'SET_TOAST', payload: { message: 'Category added', type: 'success' } });
      }
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to add category', type: 'error' } });
    }
  };

  const handleUpdateCategory = async (id: string, name: string, color: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const cat = await res.json();
        dispatch({ type: 'UPDATE_CATEGORY', payload: cat });
      }
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to update category', type: 'error' } });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        dispatch({ type: 'REMOVE_CATEGORY', payload: id });
        dispatch({ type: 'SET_TOAST', payload: { message: 'Category deleted', type: 'success' } });
      } else if (res.status === 409) {
        dispatch({ type: 'SET_TOAST', payload: { message: 'Cannot delete category with associated companies', type: 'error' } });
      }
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to delete category', type: 'error' } });
    }
  };

  const handleSelectCompany = useCallback((id: string) => {
    dispatch({ type: 'SET_DRAWER_MODE', payload: 'view' });
    dispatch({ type: 'SET_SELECTED_COMPANY', payload: id });
  }, []);

  const handleUpdateCompany = useCallback(async (id: string, fields: Partial<Company>) => {
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const updated = await res.json();
        dispatch({ type: 'UPDATE_COMPANY', payload: updated });
      }
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to update', type: 'error' } });
    }
  }, []);

  const handleCreateCompany = useCallback(async (fields: Partial<Company>) => {
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const created = await res.json();
        dispatch({ type: 'ADD_COMPANY', payload: created });
        dispatch({ type: 'SET_TOAST', payload: { message: 'Prospect created', type: 'success' } });
        // Log activity
        fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: created.id, action: 'company_created', details: created.name }),
        }).catch(() => {});
      }
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to create', type: 'error' } });
    }
  }, []);

  const handleDeleteCompany = useCallback(async (id: string) => {
    try {
      const company = state.companies.find((c) => c.id === id);
      const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        dispatch({ type: 'REMOVE_COMPANY', payload: id });
        dispatch({ type: 'SET_TOAST', payload: { message: 'Prospect deleted', type: 'success' } });
        // Log activity
        fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'company_deleted', details: company?.name || id }),
        }).catch(() => {});
      } else {
        dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to delete', type: 'error' } });
      }
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to delete', type: 'error' } });
    }
  }, [state.companies]);

  const handleSortChange = useCallback((by: SortBy) => {
    dispatch({ type: 'TOGGLE_SORT', payload: by });
  }, []);

  // Kanban drag-and-drop status update
  const handleKanbanStatusUpdate = useCallback(async (companyId: string, newStatus: Status) => {
    const company = state.companies.find((c) => c.id === companyId);
    if (!company) return;
    const oldStatus = company.status;
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        dispatch({ type: 'UPDATE_COMPANY', payload: updated });
        // Auto-note
        fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, body: `Status changed from ${oldStatus} to ${newStatus} (drag & drop)` }),
        }).catch(() => {});
        // Log activity
        fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, action: 'status_changed', details: `${oldStatus} → ${newStatus} (kanban)` }),
        }).catch(() => {});
      }
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Failed to update status', type: 'error' } });
    }
  }, [state.companies]);

  // Bulk action handler
  const handleBulkAction = useCallback(async (action: string, value?: string) => {
    const ids = Array.from(state.selectedIds);
    if (ids.length === 0) return;

    try {
      const res = await fetch('/api/companies/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, value }),
      });
      if (res.ok) {
        const result = await res.json();
        dispatch({ type: 'SET_TOAST', payload: { message: `${result.affected} prospects updated`, type: 'success' } });
        dispatch({ type: 'CLEAR_SELECTED_IDS' });
        await fetchData();
      } else {
        dispatch({ type: 'SET_TOAST', payload: { message: 'Bulk action failed', type: 'error' } });
      }
    } catch {
      dispatch({ type: 'SET_TOAST', payload: { message: 'Bulk action failed', type: 'error' } });
    }
  }, [state.selectedIds, fetchData]);

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: THEME.base }}>
      {/* Desktop-only overlay */}
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-8 lg:hidden"
        style={{ backgroundColor: THEME.base }}
      >
        <div className="text-center">
          <p className="text-lg font-semibold mb-2" style={{ color: THEME.textPrimary }}>Desktop Only</p>
          <p className="text-sm" style={{ color: THEME.textSecondary }}>
            Use a desktop browser (1024px+) for the best experience.
          </p>
        </div>
      </div>

      <TopBar
        state={state}
        dispatch={dispatch}
        filteredCompanies={filteredCompanies}
        onRefresh={fetchData}
        onOpenDuplicates={() => setDuplicatesOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenActivityLog={() => setActivityLogOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        {state.view !== 'dashboard' && (
          <Sidebar
            state={state}
            dispatch={dispatch}
            filteredCompanies={filteredCompanies}
          />
        )}
        <main className="flex-1 overflow-hidden flex">
          {state.isLoading ? (
            <div className="flex-1 flex">
              <div className="flex-1 p-4">
                <div className="h-full rounded-[10px] animate-pulse" style={{ backgroundColor: THEME.elevated }} />
              </div>
              <div className="w-[380px] p-4 space-y-3" style={{ borderLeft: `1px solid ${THEME.border}` }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-2 p-3 rounded-[6px] animate-pulse" style={{ backgroundColor: THEME.elevated }}>
                    <div className="h-3 rounded" style={{ backgroundColor: THEME.border, width: '70%' }} />
                    <div className="h-2 rounded" style={{ backgroundColor: THEME.border, width: '40%' }} />
                  </div>
                ))}
              </div>
            </div>
          ) : state.view === 'dashboard' ? (
            <DashboardView />
          ) : filteredCompanies.length === 0 ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={() => dispatch({ type: 'CLEAR_FILTERS' })}
            />
          ) : (
            <>
              {state.view === 'map' && (
                <MapView
                  companies={filteredCompanies}
                  selectedCompanyId={state.selectedCompanyId}
                  onSelectCompany={handleSelectCompany}
                />
              )}
              {state.view === 'heatmap' && (
                <HeatmapView
                  companies={filteredCompanies}
                  selectedCompanyId={state.selectedCompanyId}
                  onSelectCompany={handleSelectCompany}
                  heatmapMode={state.heatmapMode}
                  onToggleMode={() => dispatch({
                    type: 'SET_HEATMAP_MODE',
                    payload: state.heatmapMode === 'density' ? 'activity' : 'density',
                  })}
                />
              )}
              {state.view === 'list' && (
                <ListView
                  companies={filteredCompanies}
                  totalCount={state.companies.length}
                  onSelectCompany={handleSelectCompany}
                  selectedIds={state.selectedIds}
                  onToggleSelect={(id) => dispatch({ type: 'TOGGLE_SELECTED_ID', payload: id })}
                  onSelectAll={(ids) => dispatch({ type: 'SET_SELECTED_IDS', payload: new Set(ids) })}
                />
              )}
              {state.view === 'kanban' && (
                <KanbanView
                  companies={filteredCompanies}
                  onSelectCompany={handleSelectCompany}
                  onUpdateStatus={handleKanbanStatusUpdate}
                />
              )}
              {(state.view === 'map' || state.view === 'heatmap') && (
                <ListPanel
                  companies={filteredCompanies}
                  totalCount={state.companies.length}
                  selectedCompanyId={state.selectedCompanyId}
                  onSelectCompany={handleSelectCompany}
                  sortBy={state.sortBy}
                  sortDir={state.sortDir}
                  onSortChange={handleSortChange}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Bulk actions bar */}
      <BulkActions
        selectedCount={state.selectedIds.size}
        categories={state.categories}
        onBulkAction={handleBulkAction}
        onClear={() => dispatch({ type: 'CLEAR_SELECTED_IDS' })}
      />

      <Toast
        toast={state.toast}
        onDismiss={() => dispatch({ type: 'SET_TOAST', payload: null })}
      />

      <CategoryManager
        categories={state.categories}
        open={state.categoryManagerOpen}
        onClose={() => dispatch({ type: 'SET_CATEGORY_MANAGER', payload: false })}
        onAdd={handleAddCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
      />

      <DetailDrawer
        company={
          state.drawerMode === 'create'
            ? null
            : state.companies.find((c) => c.id === state.selectedCompanyId) || null
        }
        categories={state.categories}
        drawerMode={state.drawerMode}
        onClose={() => {
          dispatch({ type: 'SET_SELECTED_COMPANY', payload: null });
          dispatch({ type: 'SET_DRAWER_MODE', payload: 'view' });
        }}
        onUpdate={handleUpdateCompany}
        onCreate={handleCreateCompany}
        onDelete={handleDeleteCompany}
        onOpenEmail={() => dispatch({ type: 'SET_EMAIL_MODAL', payload: true })}
        onToast={(msg, type) => dispatch({ type: 'SET_TOAST', payload: { message: msg, type } })}
      />

      {state.emailModalOpen && state.selectedCompanyId && (() => {
        const sc = state.companies.find((c) => c.id === state.selectedCompanyId);
        return sc ? (
          <EmailModal
            company={sc}
            open={state.emailModalOpen}
            onClose={() => dispatch({ type: 'SET_EMAIL_MODAL', payload: false })}
            onSent={fetchData}
            onToast={(msg, type) => dispatch({ type: 'SET_TOAST', payload: { message: msg, type } })}
          />
        ) : null;
      })()}

      {/* Modals */}
      <DuplicateDetector
        open={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        onSelectCompany={handleSelectCompany}
        onDeleteCompany={handleDeleteCompany}
        onToast={(msg, type) => dispatch({ type: 'SET_TOAST', payload: { message: msg, type } })}
      />

      <TemplateManager
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onToast={(msg, type) => dispatch({ type: 'SET_TOAST', payload: { message: msg, type } })}
      />

      <ActivityLog
        open={activityLogOpen}
        onClose={() => setActivityLogOpen(false)}
        onSelectCompany={handleSelectCompany}
      />
    </div>
  );
}
