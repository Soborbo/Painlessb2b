import { STATUS_CONFIG } from '../../lib/constants';
import type { Status } from './types';

interface Props {
  status: Status;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

export default function StatusBadge({ status, size = 'md', onClick }: Props) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses} ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: config.color + '20',
        color: config.color,
      }}
      onClick={onClick}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}
