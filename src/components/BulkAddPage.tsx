import { useMemo, useState } from 'react';
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { THEME, SITE_CONFIG } from '../lib/site-config';

// Column order the user pastes, left to right. Must match
// /api/import-csv field names exactly.
const COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'address', label: 'Address', required: false },
  { key: 'postcode', label: 'Postcode', required: false },
  { key: 'phone', label: 'Company phone', required: false },
  { key: 'website', label: 'Website', required: false },
  { key: 'generic_email', label: 'Generic email', required: false },
  { key: 'contact_name', label: 'Contact name', required: false },
  { key: 'contact_email', label: 'Contact email', required: false },
  { key: 'contact_phone', label: 'Contact phone', required: false },
  { key: 'category', label: 'Category', required: false },
] as const;

const EXAMPLE = [
  'Smith & Co Solicitors, 12 High Street London, SW1A 1AA, +44 20 1234 5678, https://smithco.co.uk, info@smithco.co.uk, Jane Smith, jane@smithco.co.uk, +44 7700 111222, Solicitor',
  'Bristol Estate Agents, 45 Park Row Bristol, BS1 5LH, +44 117 345 6789, https://bristolea.co.uk, hello@bristolea.co.uk, Tom Brown, tom@bristolea.co.uk, +44 7700 222333, Estate Agent',
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
    if (!values[0]) error = 'Missing company name';
    else if (values.length > COLUMNS.length) error = `Too many columns (${values.length}, max ${COLUMNS.length})`;
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
        const err: any = await res.json().catch(() => ({ error: 'Upload failed' }));
        setSubmitError(err.error || 'Upload failed');
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch {
      setSubmitError('Upload failed');
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
          <ArrowLeft size={16} /> Back
        </a>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: THEME.textPrimary }}>
            Bulk Add Prospects
          </h1>
          <p className="text-xs" style={{ color: THEME.textMuted }}>
            {SITE_CONFIG.name} — upload many companies at once
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
            How it works
          </h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm" style={{ color: THEME.textSecondary }}>
            <li>Open a spreadsheet (Excel / Google Sheets / Numbers).</li>
            <li>Fill one row per company, using the column order shown below.</li>
            <li>Select the cells, <strong>Ctrl+C</strong> (or <strong>Cmd+C</strong>), then paste (<strong>Ctrl+V</strong>) into the box below.</li>
            <li>Or type rows directly with commas between fields.</li>
          </ol>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: THEME.textMuted }}>
              Column order (left to right)
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
              Only <strong>Name</strong> is required. The rest can be left blank. Duplicates (same name + postcode) will be skipped.
            </p>
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold" style={{ color: THEME.textPrimary }}>
              Paste data
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleLoadExample}
                className="text-xs px-2 py-1 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textSecondary }}
              >
                Load example
              </button>
              <button
                onClick={handleClear}
                className="text-xs px-2 py-1 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textSecondary }}
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null); setSubmitError(null); }}
            placeholder="Paste rows here… (one row = one company)"
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
              Detected separator: {parsed.separator === '\t' ? 'Tab (pasted from spreadsheet)' : 'Comma'} ·
              {' '}Valid rows: {validRowCount}
              {errorCount > 0 && <> · <span style={{ color: '#ef4444' }}>Errors: {errorCount}</span></>}
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
                Preview ({parsed.rows.length} row{parsed.rows.length !== 1 ? 's' : ''})
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
                    <th className="px-3 py-2 text-left font-medium" style={{ color: THEME.textMuted }}>Status</th>
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
                            <Check size={12} /> Ready
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
            <p className="text-sm font-semibold">Upload complete.</p>
            <p className="text-sm mt-1">
              <strong>{result.imported}</strong> created ·
              {' '}<strong>{result.skipped}</strong> duplicates skipped
              {result.errored > 0 && <> · <strong>{result.errored}</strong> errored</>}
              {' '}(<strong>{result.total}</strong> total).
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="/"
                className="text-xs px-3 py-1.5 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
              >
                Back to app
              </a>
              <button
                onClick={handleClear}
                className="text-xs px-3 py-1.5 rounded-[6px] cursor-pointer"
                style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textSecondary }}
              >
                Upload more
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
                ? `${validRowCount} compan${validRowCount === 1 ? 'y' : 'ies'} will be uploaded.`
                : 'Paste at least one row to upload.'}
            </p>
            <button
              onClick={handleSubmit}
              disabled={validRowCount === 0 || submitting}
              className="px-6 py-2.5 rounded-[10px] text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: THEME.accent, color: THEME.accentForeground }}
            >
              {submitting ? 'Uploading…' : `Upload (${validRowCount})`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
