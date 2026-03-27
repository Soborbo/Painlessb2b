import { THEME } from '../../lib/site-config';

interface Props {
  currentDate: string | null;
  onChange: (date: string | null) => void;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isOverdue(date: string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date(new Date().toISOString().slice(0, 10));
}

function daysOverdue(date: string): number {
  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function FollowUpPicker({ currentDate, onChange }: Props) {
  const quickButtons = [
    { label: '+3d', days: 3 },
    { label: '+7d', days: 7 },
    { label: '+14d', days: 14 },
    { label: '+30d', days: 30 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={currentDate || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="flex-1 px-3 py-1.5 rounded-[6px] text-sm outline-none"
          style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
        />
        {currentDate && (
          <button
            onClick={() => onChange(null)}
            className="text-xs px-2 py-1 rounded cursor-pointer"
            style={{ color: THEME.textSecondary }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {quickButtons.map((btn) => (
          <button
            key={btn.label}
            onClick={() => onChange(addDays(btn.days))}
            className="text-xs px-2.5 py-1 rounded-[6px] transition-all duration-200 cursor-pointer"
            style={{ backgroundColor: THEME.elevated, border: `1px solid ${THEME.border}`, color: THEME.textPrimary }}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {currentDate && isOverdue(currentDate) && (
        <div className="text-xs font-medium" style={{ color: '#f97316' }}>
          Overdue by {daysOverdue(currentDate)} days
        </div>
      )}
    </div>
  );
}
