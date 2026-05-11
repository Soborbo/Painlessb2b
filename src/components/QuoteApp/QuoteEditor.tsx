import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Quote, TemplateMeta, TemplateFieldDef } from '../../quotes/types';

interface Props {
  quote: Quote;
  template: TemplateMeta;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function QuoteEditor({ quote: initialQuote, template }: Props) {
  const [fieldData, setFieldData] = useState<Record<string, string>>(
    initialQuote.field_data
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(
    initialQuote.updated_at
      ? new Date(initialQuote.updated_at.replace(' ', 'T') + 'Z').getTime()
      : null
  );
  const [previewVersion, setPreviewVersion] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Track the latest field_data ref so the debounced PATCH sends the
  // freshest value, not the snapshot captured when the timer started.
  const fieldDataRef = useRef(fieldData);
  fieldDataRef.current = fieldData;
  const saveTimer = useRef<number | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, TemplateFieldDef[]>();
    for (const f of template.fields) {
      const arr = map.get(f.group) ?? [];
      arr.push(f);
      map.set(f.group, arr);
    }
    return Array.from(map.entries());
  }, [template]);

  const persist = useCallback(async () => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/quotes/${initialQuote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_data: fieldDataRef.current }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveState('saved');
      setSavedAt(Date.now());
      setPreviewVersion((v) => v + 1);
    } catch (e) {
      console.error('autosave failed', e);
      setSaveState('error');
    }
  }, [initialQuote.id]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(persist, AUTOSAVE_DEBOUNCE_MS);
  }, [persist]);

  // Save in-flight values when the user navigates away.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === 'saving' || saveTimer.current !== null) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  const setField = useCallback(
    (id: string, value: string) => {
      setFieldData((prev) => ({ ...prev, [id]: value }));
      scheduleSave();
    },
    [scheduleSave]
  );

  const resetField = useCallback(
    (field: TemplateFieldDef) => {
      setField(field.id, field.default);
    },
    [setField]
  );

  const resetAll = useCallback(async () => {
    if (!window.confirm('Reset all fields to template defaults?')) return;
    const res = await fetch(`/api/quotes/${initialQuote.id}/reset`, {
      method: 'POST',
    });
    if (!res.ok) {
      alert('Reset failed');
      return;
    }
    const updated = await res.json();
    setFieldData(updated.field_data);
    setSaveState('saved');
    setSavedAt(Date.now());
    setPreviewVersion((v) => v + 1);
  }, [initialQuote.id]);

  const toggleGroup = useCallback((title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const previewSrc = `/api/quotes/${initialQuote.id}/preview?v=${previewVersion}`;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <a
            href="/quotes"
            className="text-sm text-gray-500 hover:text-gray-900 hover:underline"
          >
            ← Quotes
          </a>
          <div>
            <div className="text-sm font-medium">{template.name}</div>
            <div className="text-xs text-gray-500">
              Quote #{initialQuote.id.slice(0, 8)} · {initialQuote.status}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <SaveIndicator state={saveState} savedAt={savedAt} />
          <button
            onClick={resetAll}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Reset all
          </button>
          <a
            href={`/api/quotes/${initialQuote.id}/preview-pdf?download=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Download PDF
          </a>
          <button
            disabled
            title="Send modal coming in M5"
            className="cursor-not-allowed rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white opacity-50"
          >
            Send
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[420px] overflow-y-auto border-r border-gray-200 bg-white">
          {groups.map(([groupTitle, fields]) => {
            const collapsed = collapsedGroups.has(groupTitle);
            return (
              <section key={groupTitle} className="border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupTitle)}
                  className="flex w-full items-center justify-between bg-gray-50 px-4 py-2 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <span>{groupTitle}</span>
                  <span className="text-xs text-gray-400">
                    {collapsed ? '▸' : '▾'}
                  </span>
                </button>
                {!collapsed && (
                  <div className="space-y-3 px-4 py-3">
                    {fields.map((field) => (
                      <FieldRow
                        key={field.id}
                        field={field}
                        value={fieldData[field.id] ?? ''}
                        onChange={(v) => setField(field.id, v)}
                        onReset={() => resetField(field)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </aside>

        <main className="flex-1 overflow-hidden bg-gray-100">
          <iframe
            key={previewVersion}
            src={previewSrc}
            title="Quote preview"
            className="h-full w-full border-0 bg-white"
            sandbox="allow-same-origin"
          />
        </main>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  onReset,
}: {
  field: TemplateFieldDef;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const isDirty = value !== field.default;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700" htmlFor={`f-${field.id}`}>
          {field.label}
        </label>
        {isDirty && (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] text-gray-400 hover:text-indigo-600"
            title="Reset to template default"
          >
            reset
          </button>
        )}
      </div>
      {field.type === 'textarea' ? (
        <textarea
          id={`f-${field.id}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
      ) : (
        <input
          id={`f-${field.id}`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
      )}
    </div>
  );
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 15_000);
    return () => window.clearInterval(t);
  }, []);
  if (state === 'saving') {
    return <span className="text-xs text-gray-500">Saving…</span>;
  }
  if (state === 'error') {
    return <span className="text-xs text-red-600">Save failed — retrying on next change</span>;
  }
  if (savedAt) {
    const ago = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
    let label: string;
    if (ago < 5) label = 'Saved just now';
    else if (ago < 60) label = `Saved ${ago}s ago`;
    else if (ago < 3600) label = `Saved ${Math.floor(ago / 60)}m ago`;
    else label = `Saved ${Math.floor(ago / 3600)}h ago`;
    return <span className="text-xs text-gray-500">{label}</span>;
  }
  return null;
}
