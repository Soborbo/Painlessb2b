import { Bell } from 'lucide-react';

interface Props {
  count: number;
  active: boolean;
  onClick: () => void;
}

export default function ReminderBadge({ count, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-[6px] transition-all duration-200 cursor-pointer"
      style={{ color: active || count > 0 ? '#f97316' : '#8990b0' }}
      title={`${count} overdue follow-ups`}
    >
      <Bell size={18} />
      {count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-mono font-bold flex items-center justify-center"
          style={{ backgroundColor: '#ef4444', color: '#fff' }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
