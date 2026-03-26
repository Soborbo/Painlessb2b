import { STATUS_CONFIG } from '../../lib/constants';
import { formatRelativeTime } from '../../lib/utils';
import type { Company } from './types';
import PriorityBadge from './PriorityBadge';

interface Props {
  company: Company;
  selected: boolean;
  onClick: () => void;
}

function isOverdue(c: Company): boolean {
  if (!c.follow_up_date) return false;
  if (['partner', 'rejected', 'not_interested'].includes(c.status)) return false;
  return new Date(c.follow_up_date) <= new Date();
}

function daysOverdue(c: Company): number {
  if (!c.follow_up_date) return 0;
  const diff = Date.now() - new Date(c.follow_up_date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function ProspectCard({ company, selected, onClick }: Props) {
  const statusColor = STATUS_CONFIG[company.status]?.color || '#6b7280';
  const overdue = isOverdue(company);

  return (
    <div
      onClick={onClick}
      className="px-3 py-2.5 cursor-pointer transition-all duration-200 group"
      style={{
        borderLeft: `3px solid ${selected ? '#818cf8' : 'transparent'}`,
        backgroundColor: selected ? '#1a1d2a' : 'transparent',
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: statusColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: '#e8eaf4' }}>
              {company.name}
            </span>
            {company.priority === 'high' && <PriorityBadge priority="high" />}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#5c6280' }}>
            {company.category_name || 'Uncategorized'}
          </div>
          {overdue && (
            <div className="text-xs mt-1 font-medium" style={{ color: '#f97316' }}>
              Follow up overdue ({daysOverdue(company)}d)
            </div>
          )}
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: '#5c6280' }}>
          {formatRelativeTime(company.updated_at)}
        </span>
      </div>
    </div>
  );
}
