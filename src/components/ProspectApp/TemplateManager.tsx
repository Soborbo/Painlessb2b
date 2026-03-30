import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3, Save, Info } from 'lucide-react';
import { THEME } from '../../lib/site-config';
import type { CustomEmailTemplate } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const PLACEHOLDERS = [
  { key: '{{company_name}}', desc: 'Company name' },
  { key: '{{contact_name}}', desc: 'Contact person name' },
  { key: '{{category}}', desc: 'Company category' },
  { key: '{{your_name}}', desc: 'Your name (Laszlo)' },
];

export default function TemplateManager({ open, onClose, onToast }: Props) {
  const [templates, setTemplates] = useState<CustomEmailTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/custom-templates')
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, [open]);

  const resetForm = () => {
    setForm({ name: '', subject: '', body: '' });
    setEditingId(null);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.subject || !form.body) {
      onToast('All fields are required', 'error');
      return;
    }

    if (editingId) {
      const res = await fetch(`/api/custom-templates/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
        onToast('Template updated', 'success');
        resetForm();
      }
    } else {
      const res = await fetch('/api/custom-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const created = await res.json();
        setTemplates((prev) => [created, ...prev]);
        onToast('Template created', 'success');
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/custom-templates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      onToast('Template deleted', 'success');
    }
  };

  const handleEdit = (template: CustomEmailTemplate) => {
    setEditingId(template.id);
    setForm({ name: template.name, subject: template.subject, body: template.body });
    setCreating(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" data-modal-overlay>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-[14px] p-6 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: THEME.textPrimary }}>Email Templates</h2>
          <button onClick={onClose} className="p-1 cursor-pointer" style={{ color: THEME.textSecondary }}>
            <X size={20} />
          </button>
        </div>

        {/* Placeholder info */}
        <div className="mb-4 p-3 rounded-[6px]" style={{ backgroundColor: THEME.elevated }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Info size={14} style={{ color: THEME.accent }} />
            <span className="text-xs font-semibold" style={{ color: THEME.textPrimary }}>Available Placeholders</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDERS.map((p) => (
              <span key={p.key} className="text-xs px-2 py-0.5 rounded font-mono" style={{ backgroundColor: THEME.surface, color: THEME.accent }}>
                {p.key} <span style={{ color: THEME.textMuted }}>({p.desc})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Create / Edit form */}
        {creating ? (
          <div className="space-y-3 mb-4 p-4 rounded-[10px]" style={{ border: `1px solid ${THEME.border}` }}>
            <h3 className="text-sm font-semibold" style={{ color: THEME.textPrimary }}>
              {editingId ? 'Edit Template' : 'New Template'}
            </h3>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: THEME.textMuted }}>Template Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-[6px] text-sm outline-none"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: THEME.textMuted }}>Subject</label>
              <input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full px-3 py-2 rounded-[6px] text-sm outline-none"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
                placeholder="Use {{company_name}}, {{contact_name}} etc."
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: THEME.textMuted }}>Body</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={8}
                className="w-full px-3 py-2 rounded-[6px] text-sm outline-none resize-none"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
                placeholder="Hi {{contact_name}}, ..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-[6px] text-sm cursor-pointer"
                style={{ backgroundColor: THEME.elevated, color: THEME.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-sm font-medium cursor-pointer"
                style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
              >
                <Save size={14} />
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[6px] text-sm font-medium cursor-pointer mb-4"
            style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
          >
            <Plus size={14} />
            New Template
          </button>
        )}

        {/* Template list */}
        <div className="space-y-2">
          {templates.length === 0 && !creating && (
            <p className="text-sm text-center py-8" style={{ color: THEME.textMuted }}>
              No custom templates yet. Create one to get started.
            </p>
          )}
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-3 rounded-[6px]"
              style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: THEME.textPrimary }}>{tmpl.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(tmpl)} className="p-1 cursor-pointer" style={{ color: THEME.textSecondary }}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(tmpl.id)} className="p-1 cursor-pointer" style={{ color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs mt-1" style={{ color: THEME.textMuted }}>Subject: {tmpl.subject}</p>
              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: THEME.textMuted }}>{tmpl.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
