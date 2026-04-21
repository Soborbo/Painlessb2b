export interface Category {
  id: string;
  name: string;
  color: string;
  created_at: string;
  company_count?: number;
}

export interface Company {
  id: string;
  name: string;
  category_id: string | null;
  category_name?: string;
  category_color?: string;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  generic_email: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: Status;
  priority: Priority;
  source: string | null;
  source_url: string | null;
  google_place_id: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  company_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  company_id: string;
  body: string;
  created_at: string;
}

export interface EmailLog {
  id: string;
  company_id: string;
  to_email: string;
  subject: string;
  body: string;
  status: 'sent' | 'failed';
  sent_at: string;
}

export type Status = 'new' | 'contacted' | 'follow_up' | 'in_conversation' | 'partner' | 'rejected' | 'not_interested';
export type Priority = 'high' | 'medium' | 'low';
export interface ActivityLogEntry {
  id: string;
  company_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
  company_name?: string;
}

export interface CustomEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  postcode: string | null;
  address: string | null;
  score: number;
}

export type View = 'map' | 'list' | 'kanban' | 'heatmap' | 'dashboard';
export type HeatmapMode = 'density' | 'activity';
export type SortBy = 'name' | 'status' | 'priority' | 'updated' | 'follow_up';
export type DrawerMode = 'view' | 'create';

export interface Filters {
  search: string;
  statuses: string[];
  categories: string[];
  priorities: string[];
  hasEmail: boolean;
  hasContact: boolean;
  overdueOnly: boolean;
}

export interface ToastData {
  message: string;
  type: 'success' | 'error';
}

export interface AppState {
  companies: Company[];
  categories: Category[];
  filters: Filters;
  view: View;
  heatmapMode: HeatmapMode;
  selectedCompanyId: string | null;
  drawerMode: DrawerMode;
  emailModalOpen: boolean;
  sortBy: SortBy;
  sortDir: 'asc' | 'desc';
  overdueCount: number;
  isLoading: boolean;
  toast: ToastData | null;
  categoryManagerOpen: boolean;
  selectedIds: Set<string>;
  bulkActionOpen: boolean;
}

export type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_COMPANIES'; payload: Company[] }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'UPDATE_COMPANY'; payload: Company }
  | { type: 'ADD_COMPANY'; payload: Company }
  | { type: 'REMOVE_COMPANY'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'REMOVE_CATEGORY'; payload: string }
  | { type: 'SET_FILTER_SEARCH'; payload: string }
  | { type: 'TOGGLE_FILTER_STATUS'; payload: string }
  | { type: 'SET_FILTER_STATUSES'; payload: string[] }
  | { type: 'TOGGLE_FILTER_CATEGORY'; payload: string }
  | { type: 'SET_FILTER_CATEGORIES'; payload: string[] }
  | { type: 'TOGGLE_FILTER_PRIORITY'; payload: string }
  | { type: 'SET_FILTER_PRIORITIES'; payload: string[] }
  | { type: 'TOGGLE_HAS_EMAIL' }
  | { type: 'TOGGLE_HAS_CONTACT' }
  | { type: 'TOGGLE_OVERDUE_ONLY' }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_VIEW'; payload: View }
  | { type: 'SET_HEATMAP_MODE'; payload: HeatmapMode }
  | { type: 'SET_SELECTED_COMPANY'; payload: string | null }
  | { type: 'SET_DRAWER_MODE'; payload: DrawerMode }
  | { type: 'SET_EMAIL_MODAL'; payload: boolean }
  | { type: 'SET_SORT'; payload: { by: SortBy; dir: 'asc' | 'desc' } }
  | { type: 'TOGGLE_SORT'; payload: SortBy }
  | { type: 'SET_OVERDUE_COUNT'; payload: number }
  | { type: 'SET_TOAST'; payload: ToastData | null }
  | { type: 'SET_CATEGORY_MANAGER'; payload: boolean }
  | { type: 'TOGGLE_SELECTED_ID'; payload: string }
  | { type: 'SET_SELECTED_IDS'; payload: Set<string> }
  | { type: 'CLEAR_SELECTED_IDS' }
  | { type: 'SET_BULK_ACTION'; payload: boolean };
