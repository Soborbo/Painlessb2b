import { PRIORITY_CONFIG } from '../../lib/constants';
import type { Priority } from './types';

interface Props {
  priority: Priority;
}

export default function PriorityBadge({ priority }: Props) {
  const config = PRIORITY_CONFIG[priority];
  if (!config) return null;

  return (
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium"
      style={{
        backgroundColor: config.color + '20',
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
}
