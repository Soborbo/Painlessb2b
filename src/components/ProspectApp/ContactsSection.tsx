import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Phone, Copy, Trash2, Star, Plus } from 'lucide-react';
import { THEME } from '../../lib/site-config';
import type { Contact } from './types';

interface Props {
  companyId: string;
  onToast: (msg: string, type: 'success' | 'error') => void;
  onContactsChanged?: () => void;
}

type Field = 'name' | 'email' | 'phone' | 'role';

function InlineField({ value, onSave, placeholder, type = 'text' }: {
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
      className="cursor-pointer hover:opacity-80 transition-opacity text-sm block py-0.5 truncate"
      style={{ color: value ? THEME.textPrimary : THEME.textMuted }}
    >
      {value || placeholder}
    </span>
  );
}

export default function ContactsSection({ companyId, onToast, onContactsChanged }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?company_id=${encodeURIComponent(companyId)}`);
      if (!res.ok) throw new Error('load failed');
      const data: Contact[] = await res.json();
      setContacts(data);
    } catch {
      onToast('Failed to load contacts', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, onToast]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      });
      if (!res.ok) throw new Error();
      await load();
      onContactsChanged?.();
    } catch {
      onToast('Failed to add contact', 'error');
    }
  }, [companyId, load, onToast, onContactsChanged]);

  const handleUpdate = useCallback(async (id: string, field: Field, value: string) => {
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      const updated: Contact = await res.json();
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      onContactsChanged?.();
    } catch {
      onToast('Failed to save contact', 'error');
    }
  }, [onToast, onContactsChanged]);

  const handleMakePrimary = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_primary: true }),
      });
      if (!res.ok) throw new Error();
      await load();
      onContactsChanged?.();
    } catch {
      onToast('Failed to update primary', 'error');
    }
  }, [load, onToast, onContactsChanged]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setConfirmDeleteId(null);
      await load();
      onContactsChanged?.();
    } catch {
      onToast('Failed to delete contact', 'error');
    }
  }, [load, onToast, onContactsChanged]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => onToast('Copied', 'success'))
      .catch(() => onToast('Failed to copy', 'error'));
  }, [onToast]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>
          Contacts {contacts.length > 0 && <span className="normal-case font-normal">({contacts.length})</span>}
        </h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-[6px] cursor-pointer transition-colors"
          style={{ backgroundColor: THEME.accent + '20', color: THEME.accent }}
          title="Add contact"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-xs" style={{ color: THEME.textMuted }}>Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="text-xs" style={{ color: THEME.textMuted }}>No contacts yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="p-3 rounded-[8px]"
              style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}` }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <InlineField
                    value={contact.name || ''}
                    onSave={(v) => handleUpdate(contact.id, 'name', v)}
                    placeholder="Contact name"
                  />
                  <InlineField
                    value={contact.role || ''}
                    onSave={(v) => handleUpdate(contact.id, 'role', v)}
                    placeholder="Role (optional)"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => !contact.is_primary && handleMakePrimary(contact.id)}
                    className="p-1 cursor-pointer"
                    title={contact.is_primary ? 'Primary contact' : 'Make primary'}
                    style={{ color: contact.is_primary ? THEME.accent : THEME.textMuted }}
                  >
                    <Star size={14} fill={contact.is_primary ? THEME.accent : 'none'} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDeleteId === contact.id) handleDelete(contact.id);
                      else setConfirmDeleteId(contact.id);
                    }}
                    onBlur={() => setConfirmDeleteId((prev) => (prev === contact.id ? null : prev))}
                    className="p-1 cursor-pointer"
                    title={confirmDeleteId === contact.id ? 'Click again to confirm' : 'Delete contact'}
                    style={{ color: confirmDeleteId === contact.id ? '#ef4444' : THEME.textMuted }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[70px_1fr] gap-y-1 gap-x-2 text-sm">
                <span style={{ color: THEME.textMuted }}>Email</span>
                <div className="flex items-center gap-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <InlineField
                      value={contact.email || ''}
                      onSave={(v) => handleUpdate(contact.id, 'email', v)}
                      placeholder="—"
                      type="email"
                    />
                  </div>
                  {contact.email && (
                    <>
                      <a href={`mailto:${contact.email}`} style={{ color: THEME.accent }}><Mail size={12} /></a>
                      <button onClick={() => handleCopy(contact.email!)} className="cursor-pointer" style={{ color: THEME.accent }}><Copy size={12} /></button>
                    </>
                  )}
                </div>

                <span style={{ color: THEME.textMuted }}>Phone</span>
                <div className="flex items-center gap-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <InlineField
                      value={contact.phone || ''}
                      onSave={(v) => handleUpdate(contact.id, 'phone', v)}
                      placeholder="—"
                      type="tel"
                    />
                  </div>
                  {contact.phone && <a href={`tel:${contact.phone}`} style={{ color: THEME.accent }}><Phone size={12} /></a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
