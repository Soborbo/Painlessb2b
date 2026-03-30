import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { THEME } from '../../lib/site-config';

interface Prediction {
  place_id: string;
  description: string;
}

interface PlaceDetails {
  lat: number | null;
  lng: number | null;
  address: string | null;
  name: string | null;
  phone: string | null;
  website: string | null;
}

interface Props {
  onSelect: (details: PlaceDetails & { place_id: string }) => void;
}

export default function AddressAutocomplete({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup debounce and abort on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const search = useCallback(async (input: string) => {
    if (!input || input.length < 3) {
      setPredictions([]);
      return;
    }

    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, types: 'establishment' }),
        signal: controller.signal,
      });
      const data = await res.json();
      setPredictions(data.predictions || []);
      setOpen(true);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setPredictions([]);
      }
    }
    setLoading(false);
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    setOpen(false);
    setQuery(prediction.description);
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?place_id=${encodeURIComponent(prediction.place_id)}`);
      if (res.ok) {
        const details: PlaceDetails = await res.json();
        onSelect({ ...details, place_id: prediction.place_id });
      } else {
        onSelect({
          lat: null, lng: null,
          address: prediction.description,
          name: null, phone: null, website: null,
          place_id: prediction.place_id,
        });
      }
    } catch {
      onSelect({
        lat: null, lng: null,
        address: prediction.description,
        name: null, phone: null, website: null,
        place_id: prediction.place_id,
      });
    }
    setLoading(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2">
        <MapPin size={14} style={{ color: THEME.accent }} />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search address or business..."
          className="w-full px-3 py-2 rounded-[6px] text-sm outline-none"
          style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
        />
        {loading && <Loader2 size={14} className="animate-spin" style={{ color: THEME.textMuted }} />}
      </div>

      {open && predictions.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-[6px] py-1 z-20 max-h-[200px] overflow-y-auto shadow-lg"
          style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
          role="listbox"
        >
          {predictions.map((p) => (
            <button
              key={p.place_id}
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors"
              style={{ color: THEME.textPrimary }}
              role="option"
            >
              {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
