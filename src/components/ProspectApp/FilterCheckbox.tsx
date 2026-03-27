import { THEME } from '../../lib/site-config';

interface Props {
  label: string;
  checked: boolean;
  onChange: () => void;
  color?: string;
  count?: number;
  shape?: 'dot' | 'square';
}

export default function FilterCheckbox({ label, checked, onChange, color, count, shape = 'dot' }: Props) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group py-0.5">
      <div
        className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-200 ${
          checked
            ? 'border-accent bg-accent'
            : 'border-border bg-transparent'
        }`}
        style={checked ? { borderColor: THEME.accent, backgroundColor: THEME.accent } : { borderColor: THEME.border }}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {color && (
        <span
          className={shape === 'dot' ? 'w-2.5 h-2.5 rounded-full' : 'w-2.5 h-2.5 rounded-[2px]'}
          style={{ backgroundColor: color }}
        />
      )}
      <span className="text-sm flex-1" style={{ color: THEME.textPrimary }}>{label}</span>
      {count !== undefined && (
        <span className="text-xs font-mono" style={{ color: THEME.textMuted }}>{count}</span>
      )}
    </label>
  );
}
