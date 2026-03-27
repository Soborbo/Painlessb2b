import { useRef, useState } from 'react';
import { Upload, Download, X } from 'lucide-react';

interface Props {
  onImportComplete: (result: { imported: number; skipped: number }) => void;
  onError: (msg: string) => void;
}

interface PreviewData {
  data: any[];
  fileName: string;
}

export default function ImportExport({ onImportComplete, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        onError('Import file must contain a JSON array');
        return;
      }

      setPreview({ data, fileName: file.name });
    } catch {
      onError('Invalid JSON file');
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview.data),
      });

      if (!res.ok) {
        onError('Import failed');
        return;
      }

      const result = await res.json();
      onImportComplete(result);
    } catch {
      onError('Import failed');
    }
    setImporting(false);
    setPreview(null);
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onError('Export failed');
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-[6px] transition-all duration-200 cursor-pointer"
          style={{ color: '#8990b0' }}
          title="Import JSON"
        >
          <Upload size={18} />
        </button>
        <button
          onClick={handleExport}
          className="p-2 rounded-[6px] transition-all duration-200 cursor-pointer"
          style={{ color: '#8990b0' }}
          title="Export JSON"
        >
          <Download size={18} />
        </button>
      </div>

      {/* Import preview modal */}
      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPreview(null)} />
          <div
            className="relative w-full max-w-sm rounded-[14px] p-6"
            style={{ backgroundColor: '#13151e', border: '1px solid #2a2d42' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: '#e8eaf4' }}>Import Preview</h3>
              <button onClick={() => setPreview(null)} className="p-1 cursor-pointer" style={{ color: '#8990b0' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-sm mb-2" style={{ color: '#8990b0' }}>
              File: {preview.fileName}
            </p>
            <p className="text-sm mb-4" style={{ color: '#e8eaf4' }}>
              Will import up to <strong className="font-mono">{preview.data.length}</strong> prospect{preview.data.length !== 1 ? 's' : ''}.
              Duplicates (same name + postcode) will be skipped.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 py-2 rounded-[10px] text-sm font-medium cursor-pointer"
                style={{ backgroundColor: '#1a1d2a', border: '1px solid #2a2d42', color: '#8990b0' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex-1 py-2 rounded-[10px] text-sm font-semibold cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: '#818cf8', color: '#fff' }}
              >
                {importing ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
