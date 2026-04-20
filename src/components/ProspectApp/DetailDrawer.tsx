import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trash2, Copy, ExternalLink, Mail, Phone, ChevronDown, Calendar } from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUSES } from '../../lib/constants';
import { THEME } from '../../lib/site-config';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import type { Company, Note, Status, Priority, Category, DrawerMode } from './types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import NoteTimeline from './NoteTimeline';
import FollowUpPicker from './FollowUpPicker';
import AddressAutocomplete from './AddressAutocomplete';
import ContactsSection from './ContactsSection';

interface Props {
  company: Company | null;
  categories: Category[];
  drawerMode: DrawerMode;
  onClose: () => void;
  onUpdate: (id: string, fields: Partial<Company>) => Promise<void>;
  onCreate: (fields: Partial<Company>) => Promise<void>;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => Promise<void>;
  onOpenEmail: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

// Quick action configs per status
const QUICK_ACTIONS: Record<Status, { label: string; status: Status; showFollowUp?: boolean }[]> = {
  new: [
    { label: 'Mark Contacted', status: 'contacted', showFollowUp: true },
    { label: 'Mark Rejected', status: 'rejected' },
  ],
  contacted: [
    { label: 'Mark Follow Up', status: 'follow_up', showFollowUp: true },
    { label: 'Mark In Conversation', status: 'in_conversation' },
    { label: 'Mark Not Interested', status: 'not_interested' },
  ],
  follow_up: [
    { label: 'Mark Contacted', status: 'contacted', showFollowUp: true },
    { label: 'Mark In Conversation', status: 'in_conversation' },
    { label: 'Mark Not Interested', status: 'not_interested' },
  ],
  in_conversation: [
    { label: 'Mark Partner', status: 'partner' },
    { label: 'Mark Follow Up', status: 'follow_up', showFollowUp: true },
    { label: 'Mark Rejected', status: 'rejected' },
  ],
  partner: [
    { label: 'Mark Rejected', status: 'rejected' },
  ],
  rejected: [
    { label: 'Mark New', status: 'new' },
    { label: 'Mark Contacted', status: 'contacted', showFollowUp: true },
  ],
  not_interested: [
    { label: 'Mark New', status: 'new' },
    { label: 'Mark Contacted', status: 'contacted', showFollowUp: true },
  ],
};

function InlineEdit({ value, onSave, placeholder, type = 'text' }: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className="w-full px-2 py-1 rounded text-sm outline-none"
        style={{ backgroundColor: THEME.base, border: `1px solid ${THEME.accent}`, color: THEME.textPrimary }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:opacity-80 transition-opacity text-sm block py-0.5"
      style={{ color: value ? THEME.textPrimary : THEME.textMuted }}
    >
      {value || placeholder}
    </span>
  );
}

function buildGoogleCalendarUrl(company: Company): string {
  if (!company.follow_up_date) return '';
  const date = company.follow_up_date.replace(/-/g, '');
  // All-day event
  const endDate = new Date(company.follow_up_date);
  endDate.setDate(endDate.getDate() + 1);
  const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Follow up: ${company.name}`,
    dates: `${date}/${endStr}`,
    details: `Follow up with ${company.name}${company.contact_name ? ` (${company.contact_name})` : ''}${company.phone ? `\nPhone: ${company.phone}` : ''}${company.contact_email ? `\nEmail: ${company.contact_email}` : ''}`,
  });

  if (company.address) {
    params.set('location', `${company.address}${company.postcode ? `, ${company.postcode}` : ''}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function DetailDrawer({ company, categories, drawerMode, onClose, onUpdate, onCreate, onDelete, onRefresh, onOpenEmail, onToast }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<Company>>({ status: 'new', priority: 'medium' });
  const isOpen = company !== null || drawerMode === 'create';

  // Reset transient state when drawer opens for a different company or mode
  useEffect(() => {
    setConfirmDeleteCompany(false);
    setShowStatusMenu(false);
    setShowFollowUp(false);
    if (drawerMode === 'create') {
      setCreateForm({ status: 'new', priority: 'medium' });
    }
  }, [company?.id, drawerMode]);

  // Fetch notes
  useEffect(() => {
    if (!company || drawerMode === 'create') { setNotes([]); return; }
    let cancelled = false;
    fetch(`/api/notes/${company.id}`)
      .then((r) => { if (!r.ok) throw new Error('Failed to fetch notes'); return r.json(); })
      .then((data) => { if (!cancelled) setNotes(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [company?.id, drawerMode]);

  // Escape key — only close if no modal is layered on top
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const modal = document.querySelector('[data-modal-overlay]');
        if (modal) return;
        onClose();
      }
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleFieldUpdate = useCallback(async (field: string, value: string) => {
    if (!company) return;
    await onUpdate(company.id, { [field]: value });
  }, [company, onUpdate]);

  const handleStatusChange = useCallback(async (status: Status) => {
    if (!company) return;
    setShowStatusMenu(false);
    const oldStatus = company.status;
    await onUpdate(company.id, { status });
    // Auto-note for status change
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: company.id, body: `Status changed from ${STATUS_CONFIG[oldStatus].label} to ${STATUS_CONFIG[status].label}` }),
    });
    // Log activity
    fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: company.id, action: 'status_changed', details: `${STATUS_CONFIG[oldStatus].label} → ${STATUS_CONFIG[status].label}` }),
    }).catch(() => {});
    const res = await fetch(`/api/notes/${company.id}`);
    if (res.ok) setNotes(await res.json());
  }, [company, onUpdate]);

  const handleQuickAction = useCallback(async (action: { label: string; status: Status; showFollowUp?: boolean }) => {
    await handleStatusChange(action.status);
    if (action.showFollowUp) setShowFollowUp(true);
  }, [handleStatusChange]);

  const handleAddNote = useCallback(async (body: string) => {
    if (!company) return;
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: company.id, body }),
    });
    // Log activity
    fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: company.id, action: 'note_added', details: body.slice(0, 100) }),
    }).catch(() => {});
    const res = await fetch(`/api/notes/${company.id}`);
    if (res.ok) setNotes(await res.json());
  }, [company]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!company) return;
    await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, [company]);

  const handleFollowUpChange = useCallback(async (date: string | null) => {
    if (!company) return;
    await onUpdate(company.id, { follow_up_date: date } as any);
  }, [company, onUpdate]);

  const handleCopyEmail = useCallback((email: string) => {
    navigator.clipboard.writeText(email)
      .then(() => onToast('Copied', 'success'))
      .catch(() => onToast('Failed to copy', 'error'));
  }, [onToast]);

  const handleAddressSelect = useCallback((details: {
    lat: number | null; lng: number | null; address: string | null;
    name: string | null; phone: string | null; website: string | null; place_id: string;
  }) => {
    if (drawerMode === 'create') {
      setCreateForm((f) => ({
        ...f,
        ...(details.address && { address: details.address }),
        ...(details.lat != null && { lat: details.lat }),
        ...(details.lng != null && { lng: details.lng }),
        ...(details.phone && !f.phone && { phone: details.phone }),
        ...(details.website && !f.website && { website: details.website }),
        ...(details.name && !f.name && { name: details.name }),
        google_place_id: details.place_id,
      }));
    } else if (company) {
      const fields: Partial<Company> = {};
      if (details.address) fields.address = details.address;
      if (details.lat != null) fields.lat = details.lat;
      if (details.lng != null) fields.lng = details.lng;
      if (details.phone && !company.phone) fields.phone = details.phone;
      if (details.website && !company.website) fields.website = details.website;
      fields.google_place_id = details.place_id;
      onUpdate(company.id, fields);
    }
  }, [drawerMode, company, onUpdate]);

  const handleGeocodeAddress = useCallback(async () => {
    if (!company) return;
    const addr = [company.address, company.postcode].filter(Boolean).join(', ');
    if (!addr) { onToast('No address to geocode', 'error'); return; }
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (data.lat != null && data.lng != null) {
        await onUpdate(company.id, { lat: data.lat, lng: data.lng });
        onToast('Coordinates updated', 'success');
      } else {
        onToast('Could not geocode address', 'error');
      }
    } catch {
      onToast('Geocoding failed', 'error');
    }
  }, [company, onUpdate, onToast]);

  const handleCreate = useCallback(async () => {
    if (!createForm.name) {
      onToast('Company name is required', 'error');
      return;
    }
    await onCreate(createForm);
    onClose();
  }, [createForm, onCreate, onClose, onToast]);

  if (!isOpen) return null;

  // Create mode
  if (drawerMode === 'create') {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
        <div
          className="fixed top-0 right-0 w-[520px] h-full z-50 overflow-y-auto transition-transform duration-300 ease-out"
          style={{ backgroundColor: THEME.surface, borderLeft: `1px solid ${THEME.border}`, transform: 'translateX(0)' }}
        >
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: THEME.textPrimary }}>Add Prospect</h2>
              <button onClick={onClose} className="p-1 cursor-pointer" style={{ color: THEME.textSecondary }}><X size={20} /></button>
            </div>

            {/* Google Places Search */}
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: THEME.textMuted }}>Search Business</label>
              <AddressAutocomplete onSelect={handleAddressSelect} />
            </div>

            {(['name', 'address', 'postcode', 'phone', 'website', 'generic_email', 'contact_name', 'contact_email', 'contact_phone'] as const).map((field) => (
              <div key={field}>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: THEME.textMuted }}>{field.replace(/_/g, ' ')}</label>
                <input
                  type="text"
                  value={(createForm as any)[field] || ''}
                  onChange={(e) => setCreateForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-[6px] text-sm outline-none"
                  style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
                />
              </div>
            ))}
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: THEME.textMuted }}>Category</label>
              <select
                value={createForm.category_id || ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, category_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-[6px] text-sm outline-none cursor-pointer"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
              >
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: THEME.textMuted }}>Lat</label>
                <input type="number" step="any" value={createForm.lat ?? ''} onChange={(e) => setCreateForm((f) => ({ ...f, lat: e.target.value ? parseFloat(e.target.value) : null }))} className="w-full px-3 py-2 rounded-[6px] text-sm outline-none" style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }} />
              </div>
              <div className="flex-1">
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: THEME.textMuted }}>Lng</label>
                <input type="number" step="any" value={createForm.lng ?? ''} onChange={(e) => setCreateForm((f) => ({ ...f, lng: e.target.value ? parseFloat(e.target.value) : null }))} className="w-full px-3 py-2 rounded-[6px] text-sm outline-none" style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }} />
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="w-full py-2.5 rounded-[10px] text-sm font-semibold transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
            >
              Create Prospect
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!company) return null;

  const email = company.contact_email || company.generic_email;
  const phone = company.contact_phone || company.phone;
  const quickActions = QUICK_ACTIONS[company.status] || [];
  const calendarUrl = buildGoogleCalendarUrl(company);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div
        className="fixed top-0 right-0 w-[520px] h-full z-50 overflow-y-auto transition-transform duration-300 ease-out"
        style={{ backgroundColor: THEME.surface, borderLeft: `1px solid ${THEME.border}`, transform: 'translateX(0)' }}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <InlineEdit value={company.name} onSave={(v) => handleFieldUpdate('name', v)} placeholder="Company name" />
              <div className="flex items-center gap-2 mt-2">
                {/* Status dropdown */}
                <div className="relative">
                  <StatusBadge status={company.status} onClick={() => setShowStatusMenu(!showStatusMenu)} />
                  {showStatusMenu && (
                    <div className="absolute top-full left-0 mt-1 rounded-[6px] py-1 z-10 min-w-[160px]" style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}` }}>
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
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

                {/* Priority */}
                <select
                  value={company.priority}
                  onChange={(e) => onUpdate(company.id, { priority: e.target.value as Priority })}
                  className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
                  style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (confirmDeleteCompany) {
                    onDelete(company.id);
                    onClose();
                  } else {
                    setConfirmDeleteCompany(true);
                  }
                }}
                className="p-2 rounded-[6px] cursor-pointer transition-colors"
                style={{ color: confirmDeleteCompany ? '#ef4444' : THEME.textSecondary }}
                title={confirmDeleteCompany ? 'Click again to confirm delete' : 'Delete company'}
              >
                <Trash2 size={18} />
              </button>
              <button onClick={onClose} className="p-2 cursor-pointer" style={{ color: THEME.textSecondary }}><X size={20} /></button>
            </div>
          </div>

          {/* Google Places Search (for existing companies) */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.textMuted }}>Lookup Address</h3>
            <AddressAutocomplete onSelect={handleAddressSelect} />
            {company.address && !company.lat && (
              <button
                onClick={handleGeocodeAddress}
                className="mt-2 text-xs px-3 py-1 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.accent + '20', color: THEME.accent }}
              >
                Geocode current address
              </button>
            )}
          </div>

          {/* Contacts — multiple contacts per company */}
          <ContactsSection
            companyId={company.id}
            onToast={onToast}
            onContactsChanged={() => onRefresh(company.id)}
          />

          {/* Company info */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Company</h3>
            <div className="grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-2 text-sm">
              <span style={{ color: THEME.textMuted }}>Company Ph</span>
              <div className="flex items-center gap-1">
                <InlineEdit value={company.phone || ''} onSave={(v) => handleFieldUpdate('phone', v)} placeholder="—" />
                {company.phone && <a href={`tel:${company.phone}`} style={{ color: THEME.accent }}><Phone size={12} /></a>}
              </div>

              <span style={{ color: THEME.textMuted }}>Gen. Email</span>
              <div className="flex items-center gap-1">
                <InlineEdit value={company.generic_email || ''} onSave={(v) => handleFieldUpdate('generic_email', v)} placeholder="—" />
                {company.generic_email && (
                  <>
                    <a href={`mailto:${company.generic_email}`} style={{ color: THEME.accent }}><Mail size={12} /></a>
                    <button onClick={() => handleCopyEmail(company.generic_email!)} className="cursor-pointer" style={{ color: THEME.accent }}><Copy size={12} /></button>
                  </>
                )}
              </div>

              <span style={{ color: THEME.textMuted }}>Website</span>
              <div className="flex items-center gap-1">
                <InlineEdit value={company.website || ''} onSave={(v) => handleFieldUpdate('website', v)} placeholder="—" />
                {company.website && /^https?:\/\//i.test(company.website) && <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: THEME.accent }}><ExternalLink size={12} /></a>}
              </div>

              <span style={{ color: THEME.textMuted }}>Address</span>
              <InlineEdit value={company.address || ''} onSave={(v) => handleFieldUpdate('address', v)} placeholder="—" />

              <span style={{ color: THEME.textMuted }}>Postcode</span>
              <InlineEdit value={company.postcode || ''} onSave={(v) => handleFieldUpdate('postcode', v)} placeholder="—" />
            </div>
          </div>

          {/* Email action */}
          {email && (
            <button
              onClick={onOpenEmail}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-[6px] text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.accent }}
            >
              <Mail size={16} />
              Send Intro Email
            </button>
          )}

          {/* Quick actions */}
          {quickActions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    className="text-xs px-3 py-1.5 rounded-[6px] transition-all duration-200 cursor-pointer"
                    style={{
                      backgroundColor: STATUS_CONFIG[action.status].color + '20',
                      color: STATUS_CONFIG[action.status].color,
                      border: `1px solid ${STATUS_CONFIG[action.status].color}40`,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Follow-up</h3>
            <FollowUpPicker
              currentDate={company.follow_up_date}
              onChange={handleFollowUpChange}
            />
            {/* Google Calendar button */}
            {company.follow_up_date && calendarUrl && (
              <a
                href={calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-[6px] cursor-pointer transition-colors"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.accent }}
              >
                <Calendar size={14} />
                Add to Google Calendar
              </a>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Details</h3>
            <div className="grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-2 text-sm">
              <span style={{ color: THEME.textMuted }}>Category</span>
              <select
                value={company.category_id || ''}
                onChange={(e) => onUpdate(company.id, { category_id: e.target.value })}
                className="text-sm px-2 py-0.5 rounded outline-none cursor-pointer"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
              >
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <span style={{ color: THEME.textMuted }}>Source</span>
              <span style={{ color: THEME.textPrimary }}>{company.source || '—'}</span>

              {company.source_url && (
                <>
                  <span style={{ color: THEME.textMuted }}>Source URL</span>
                  {/^https?:\/\//i.test(company.source_url) ? (
                    <a href={company.source_url} target="_blank" rel="noopener noreferrer" className="text-sm truncate" style={{ color: THEME.accent }}>{company.source_url}</a>
                  ) : (
                    <span className="text-sm truncate" style={{ color: THEME.textSecondary }}>{company.source_url}</span>
                  )}
                </>
              )}

              {company.google_place_id && (
                <>
                  <span style={{ color: THEME.textMuted }}>Place ID</span>
                  <span className="text-xs font-mono truncate" style={{ color: THEME.textSecondary }}>{company.google_place_id}</span>
                </>
              )}

              {(company.lat != null && company.lng != null) && (
                <>
                  <span style={{ color: THEME.textMuted }}>Coordinates</span>
                  <span className="text-xs font-mono" style={{ color: THEME.textSecondary }}>{company.lat.toFixed(5)}, {company.lng.toFixed(5)}</span>
                </>
              )}

              <span style={{ color: THEME.textMuted }}>Created</span>
              <span style={{ color: THEME.textSecondary }}>{formatDate(company.created_at)}</span>

              <span style={{ color: THEME.textMuted }}>Updated</span>
              <span style={{ color: THEME.textSecondary }}>{formatRelativeTime(company.updated_at)}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Notes</h3>
            <NoteTimeline
              notes={notes}
              companyId={company.id}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
            />
          </div>
        </div>
      </div>
    </>
  );
}
