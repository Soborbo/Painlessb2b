import { useMemo, useState } from 'react';
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { THEME, SITE_CONFIG } from '../lib/site-config';

// Column order the user pastes, left to right. Must match
// /api/import-csv field names exactly.
const COLUMNS = [
  { key: 'name', label: 'Név', required: true },
  { key: 'address', label: 'Cím', required: false },
  { key: 'postcode', label: 'Irányítószám', required: false },
  { key: 'phone', label: 'Cég telefon', required: false },
  { key: 'website', label: 'Weboldal', required: false },
  { key: 'generic_email', label: 'Általános email', required: false },
  { key: 'contact_name', label: 'Kontakt név', required: false },
  { key: 'contact_email', label: 'Kontakt email', required: false },
  { key: 'contact_phone', label: 'Kontakt telefon', required: false },
  { key: 'category', label: 'Kategória', required: false },
] as const;

const EXAMPLE = [
  'Kovács Jogi Kft., Budapest Váci út 1, 1132, +36 1 234 5678, https://kovacsjogi.hu, info@kovacsjogi.hu, Kovács Anna, anna@kovacsjogi.hu, +36 30 111 2222, Solicitor',
  'Nagy Ingatlan Bt., Budapest Bajcsy 12, 1051, +36 1 345 6789, https://nagyingatlan.hu, hello@nagyingatlan.hu, Nagy Péter, peter@nagyingatlan.hu, +36 30 222 3333, Estate Agent',
].join('\n');

// Parse a single line respecting quoted fields, given a separator character.
function parseLine(line: string, sep: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) { fields.push(current.trim()); current = ''; }
      else current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function detectSeparator(text: string): '\t' | ',' {
  // If any line has a tab, treat as tab-separated (pasted from a spreadsheet).
  return text.includes('\t') ? '\t' : ',';
}

type ParsedRow = { values: string[]; error: string | null };

function parseAll(text: string): { rows: ParsedRow[]; separator: '\t' | ',' } {
  const separator = detectSeparator(text);
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const rows: ParsedRow[] = nonEmpty.map((line) => {
    const values = parseLine(line, separator);
    let error: string | null = null;
    if (!values[0]) error = 'Hiányzó cégnév';
    else if (values.length > COLUMNS.length) error = `Túl sok oszlop (${values.length}, max ${COLUMNS.length})`;
    return { values, error };
  });
  return { rows, separator };
}

// Escape a field for CSV output (quotes if it contains comma/quote/newline).
function csvEscape(s: string): string {
  if (s == null) return '';
  const needsQuote = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function rowsToCsv(rows: ParsedRow[]): string {
  const header = COLUMNS.map((c) => c.key).join(',');
  const body = rows
    .filter((r) => !r.error)
    .map((r) =>
      COLUMNS.map((_, idx) => csvEscape(r.values[idx] ?? '')).join(',')
    )
    .join('\n');
  return `${header}\n${body}\n`;
}

export default function BulkAddPage() {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errored: number; total: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsed = useMemo(() => parseAll(text), [text]);
  const validRowCount = parsed.rows.filter((r) => !r.error).length;
  const errorCount = parsed.rows.filter((r) => r.error).length;

  const handleSubmit = async () => {
    if (validRowCount === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: rowsToCsv(parsed.rows),
      });
      if (!res.ok) {
        const err: any = await res.json().catch(() => ({ error: 'Feltöltés sikertelen' }));
        setSubmitError(err.error || 'Feltöltés sikertelen');
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch {
      setSubmitError('Feltöltés sikertelen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadExample = () => setText(EXAMPLE);
  const handleClear = () => { setText(''); setResult(null); setSubmitError(null); };

  return (
    <div className="min-h-screen" style={{ backgroundColor: THEME.base }}>
      <header
        className="flex items-center gap-4 px-4 py-3"
        style={{ backgroundColor: THEME.surface, borderBottom: `1px solid ${THEME.border}` }}
      >
        <a href="/" className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: THEME.textSecondary }}>
          <ArrowLeft size={16} /> Vissza
        </a>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: THEME.textPrimary }}>
            Tömeges feltöltés
          </h1>
          <p className="text-xs" style={{ color: THEME.textMuted }}>
            {SITE_CONFIG.name} — több cég egyszerre
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Instructions */}
        <div
          className="rounded-[12px] p-5"
          style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
        >
          <h2 className="text-sm font-semibold mb-2" style={{ color: THEME.textPrimary }}>
            Hogyan működik?
          </h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm" style={{ color: THEME.textSecondary }}>
            <li>Nyiss egy Excel / Google Sheets / Numbers dokumentumot.</li>
            <li>Töltsd ki egy sort egy cégre, pontosan a lenti oszlopsorrend szerint.</li>
            <li>Jelöld ki a cellákat, <strong>Ctrl+C</strong> (vagy <strong>Cmd+C</strong>), és illeszd be (<strong>Ctrl+V</strong>) az alsó mezőbe.</li>
            <li>Vesszővel elválasztva is beírhatod kézzel, ha úgy kényelmesebb.</li>
          </ol>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: THEME.textMuted }}>
              Oszlopok sorrendje (balról jobbra)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COLUMNS.map((col, idx) => (
                <span
                  key={col.key}
                  className="text-xs px-2 py-1 rounded-[6px]"
                  style={{
                    backgroundColor: col.required ? THEME.accent + '20' : THEME.elevated,
                    color: col.required ? THEME.accent : THEME.textSecondary,
                    border: `1px solid ${col.required ? THEME.accent + '40' : THEME.border}`,
                  }}
                >
                  {idx + 1}. {col.label}{col.required && ' *'}
                </span>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: THEME.textMuted }}>
              Csak a <strong>Név</strong> kötelező. A többi üresen is hagyható. Azonos név + irányítószám duplikáció kihagyásra kerül.
            </p>
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold" style={{ color: THEME.textPrimary }}>
              Adatok beillesztése
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleLoadExample}
                className="text-xs px-2 py-1 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textSecondary }}
              >
                Példa betöltése
              </button>
              <button
                onClick={handleClear}
                className="text-xs px-2 py-1 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textSecondary }}
              >
                Törlés
              </button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null); setSubmitError(null); }}
            placeholder="Illeszd be ide a sorokat… (egy sor = egy cég)"
            rows={10}
            className="w-full px-3 py-2 rounded-[10px] text-sm font-mono outline-none"
            style={{
              backgroundColor: THEME.surface,
              border: `1px solid ${THEME.border}`,
              color: THEME.textPrimary,
            }}
          />
          {text.trim() && (
            <p className="text-xs" style={{ color: THEME.textMuted }}>
              Észlelt elválasztó: {parsed.separator === '\t' ? 'Tab (táblázatból másolva)' : 'Vessző'} ·
              {' '}Érvényes sorok: {validRowCount}
              {errorCount > 0 && <> · <span style={{ color: '#ef4444' }}>Hibás: {errorCount}</span></>}
            </p>
          )}
        </div>

        {/* Preview */}
        {parsed.rows.length > 0 && (
          <div
            className="rounded-[12px] overflow-hidden"
            style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
          >
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${THEME.border}` }}>
              <h2 className="text-sm font-semibold" style={{ color: THEME.textPrimary }}>
                Előnézet ({parsed.rows.length} sor)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: THEME.elevated }}>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: THEME.textMuted, minWidth: '30px' }}>#</th>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="px-3 py-2 text-left font-medium whitespace-nowrap"
                        style={{ color: THEME.textMuted }}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left font-medium" style={{ color: THEME.textMuted }}>Állapot</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderTop: `1px solid ${THEME.border}`,
                        backgroundColor: row.error ? '#fef2f2' : 'transparent',
                      }}
                    >
                      <td className="px-3 py-2 font-mono" style={{ color: THEME.textMuted }}>{idx + 1}</td>
                      {COLUMNS.map((_, colIdx) => (
                        <td
                          key={colIdx}
                          className="px-3 py-2 whitespace-nowrap"
                          style={{ color: THEME.textPrimary, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          title={row.values[colIdx] || ''}
                        >
                          {row.values[colIdx] || <span style={{ color: THEME.textMuted }}>—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.error ? (
                          <span className="inline-flex items-center gap-1" style={{ color: '#ef4444' }}>
                            <AlertTriangle size={12} /> {row.error}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1" style={{ color: '#10b981' }}>
                            <Check size={12} /> Rendben
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className="rounded-[12px] p-4"
            style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' }}
          >
            <p className="text-sm font-semibold">Feltöltés kész.</p>
            <p className="text-sm mt-1">
              <strong>{result.imported}</strong> cég létrehozva ·
              {' '}<strong>{result.skipped}</strong> duplikáció kihagyva
              {result.errored > 0 && <> · <strong>{result.errored}</strong> hibás sor</>}
              {' '}(<strong>{result.total}</strong> összesen).
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="/"
                className="text-xs px-3 py-1.5 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
              >
                Vissza az alkalmazáshoz
              </a>
              <button
                onClick={handleClear}
                className="text-xs px-3 py-1.5 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textSecondary }}
              >
                Még egy kör
              </button>
            </div>
          </div>
        )}

        {submitError && (
          <div
            className="rounded-[12px] p-4 text-sm"
            style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}
          >
            {submitError}
          </div>
        )}

        {/* Submit */}
        {!result && (
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: THEME.textSecondary }}>
              {validRowCount > 0
                ? `${validRowCount} cég kerül feltöltésre.`
                : 'Illessz be legalább egy sort a feltöltéshez.'}
            </p>
            <button
              onClick={handleSubmit}
              disabled={validRowCount === 0 || submitting}
              className="px-6 py-2.5 rounded-[10px] text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
            >
              {submitting ? 'Feltöltés…' : `Feltöltés (${validRowCount})`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
