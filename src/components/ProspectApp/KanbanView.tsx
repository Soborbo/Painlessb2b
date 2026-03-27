import { STATUS_CONFIG, STATUSES } from '../../lib/constants';
import { THEME } from '../../lib/site-config';
import type { Company, Status } from './types';

interface Props {
  companies: Company[];
  onSelectCompany: (id: string) => void;
}

function isOverdue(c: Company): boolean {
  if (!c.follow_up_date) return false;
  if (['partner', 'rejected', 'not_interested'].includes(c.status)) return false;
  return new Date(c.follow_up_date) <= new Date();
}

const COLUMN_ORDER: Status[] = ['new', 'contacted', 'follow_up', 'in_conversation', 'partner', 'rejected', 'not_interested'];

export default function KanbanView({ companies, onSelectCompany }: Props) {
  const grouped = COLUMN_ORDER.reduce((acc, status) => {
    acc[status] = companies.filter((c) => c.status === status);
    return acc;
  }, {} as Record<Status, Company[]>);

  return (
    <div className="flex-1 overflow-x-auto p-4">
      <div className="flex gap-3 h-full min-w-max">
        {COLUMN_ORDER.map((status) => {
          const config = STATUS_CONFIG[status];
          const cards = grouped[status];

          return (
            <div
              key={status}
              className="w-[240px] flex-shrink-0 flex flex-col rounded-[10px]"
              style={{ backgroundColor: THEME.surface }}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${THEME.border}` }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                <span className="text-xs font-semibold" style={{ color: THEME.textPrimary }}>{config.label}</span>
                <span className="text-xs font-mono ml-auto" style={{ color: THEME.textMuted }}>{cards.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {cards.length === 0 && (
                  <div className="text-xs text-center py-4" style={{ color: THEME.textMuted }}>No prospects</div>
                )}
                {cards.map((c) => {
                  const overdue = isOverdue(c);
                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelectCompany(c.id)}
                      className="px-3 py-2.5 rounded-[6px] cursor-pointer transition-all duration-200"
                      style={{
                        backgroundColor: THEME.elevated,
                        borderLeft: overdue ? '3px solid #f97316' : '3px solid transparent',
                      }}
                    >
                      <div className="text-sm font-medium" style={{ color: THEME.textPrimary }}>{c.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {c.category_name && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: (c.category_color || '#6b7280') + '20', color: c.category_color || '#6b7280' }}>
                            {c.category_name}
                          </span>
                        )}
                        {c.priority === 'high' && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
                            High
                          </span>
                        )}
                      </div>
                      {overdue && (
                        <div className="text-xs mt-1" style={{ color: '#f97316' }}>Overdue</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
