import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../lib/constants';
import { THEME } from '../../lib/site-config';
import { formatRelativeTime } from '../../lib/utils';
import type { Company, SortBy } from './types';
import PriorityBadge from './PriorityBadge';

interface Props {
  companies: Company[];
  totalCount: number;
  onSelectCompany: (id: string) => void;
}

type ColKey = 'name' | 'status' | 'category_name' | 'priority' | 'follow_up' | 'updated';

function isOverdue(c: Company): boolean {
  if (!c.follow_up_date) return false;
  if (['partner', 'rejected', 'not_interested'].includes(c.status)) return false;
  return new Date(c.follow_up_date) <= new Date();
}

export default function ListView({ companies, totalCount, onSelectCompany }: Props) {
  const [sortBy, setSortBy] = useState<ColKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (col: ColKey) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    return [...companies].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'category_name': cmp = (a.category_name || '').localeCompare(b.category_name || ''); break;
        case 'priority': {
          const o = { high: 0, medium: 1, low: 2 };
          cmp = (o[a.priority] ?? 1) - (o[b.priority] ?? 1);
          break;
        }
        case 'follow_up': {
          const aD = a.follow_up_date ? new Date(a.follow_up_date).getTime() : Infinity;
          const bD = b.follow_up_date ? new Date(b.follow_up_date).getTime() : Infinity;
          cmp = aD - bD;
          break;
        }
        case 'updated':
          cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [companies, sortBy, sortDir]);

  const SortIcon = ({ col }: { col: ColKey }) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  // Column definitions - Contact/Email/Phone are display-only, not sortable
  const columns: { key: ColKey | 'contact' | 'email' | 'phone'; label: string; width: string; sortable: boolean }[] = [
    { key: 'status', label: '', width: '40px', sortable: true },
    { key: 'name', label: 'Name', width: 'auto', sortable: true },
    { key: 'category_name', label: 'Category', width: '120px', sortable: true },
    { key: 'contact', label: 'Contact', width: '160px', sortable: false },
    { key: 'email', label: 'Email', width: '180px', sortable: false },
    { key: 'phone', label: 'Phone', width: '120px', sortable: false },
    { key: 'priority', label: 'Priority', width: '80px', sortable: true },
    { key: 'follow_up', label: 'Follow-up', width: '100px', sortable: true },
    { key: 'updated', label: 'Updated', width: '100px', sortable: true },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 text-xs font-mono" style={{ color: THEME.textSecondary }}>
        Showing {companies.length} of {totalCount} prospects
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ backgroundColor: THEME.surface }}>
              {/* Status */}
              <th className="w-[40px] px-2 py-2 text-left cursor-pointer" style={{ borderBottom: `1px solid ${THEME.border}` }} onClick={() => toggleSort('status')}>
                <div className="flex items-center gap-1" style={{ color: THEME.textMuted }}><SortIcon col="status" /></div>
              </th>
              {/* Name */}
              <th className="px-2 py-2 text-left cursor-pointer" style={{ borderBottom: `1px solid ${THEME.border}` }} onClick={() => toggleSort('name')}>
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Name <SortIcon col="name" /></div>
              </th>
              {/* Category */}
              <th className="w-[120px] px-2 py-2 text-left cursor-pointer" style={{ borderBottom: `1px solid ${THEME.border}` }} onClick={() => toggleSort('category_name')}>
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Category <SortIcon col="category_name" /></div>
              </th>
              {/* Contact */}
              <th className="w-[160px] px-2 py-2 text-left" style={{ borderBottom: `1px solid ${THEME.border}` }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Contact</span>
              </th>
              {/* Email */}
              <th className="w-[180px] px-2 py-2 text-left" style={{ borderBottom: `1px solid ${THEME.border}` }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Email</span>
              </th>
              {/* Phone */}
              <th className="w-[120px] px-2 py-2 text-left" style={{ borderBottom: `1px solid ${THEME.border}` }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Phone</span>
              </th>
              {/* Priority */}
              <th className="w-[80px] px-2 py-2 text-left cursor-pointer" style={{ borderBottom: `1px solid ${THEME.border}` }} onClick={() => toggleSort('priority')}>
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Priority <SortIcon col="priority" /></div>
              </th>
              {/* Follow-up */}
              <th className="w-[100px] px-2 py-2 text-left cursor-pointer" style={{ borderBottom: `1px solid ${THEME.border}` }} onClick={() => toggleSort('follow_up')}>
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Follow-up <SortIcon col="follow_up" /></div>
              </th>
              {/* Updated */}
              <th className="w-[100px] px-2 py-2 text-left cursor-pointer" style={{ borderBottom: `1px solid ${THEME.border}` }} onClick={() => toggleSort('updated')}>
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: THEME.textMuted }}>Updated <SortIcon col="updated" /></div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const statusColor = STATUS_CONFIG[c.status]?.color || '#6b7280';
              const email = c.contact_email || c.generic_email || '';
              const phone = c.contact_phone || c.phone || '';
              const overdue = isOverdue(c);

              return (
                <tr
                  key={c.id}
                  onClick={() => onSelectCompany(c.id)}
                  className="cursor-pointer transition-colors duration-150"
                  style={{
                    backgroundColor: i % 2 === 0 ? 'transparent' : '#0f1119',
                  }}
                >
                  <td className="px-2 py-2.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: statusColor }} />
                  </td>
                  <td className="px-2 py-2.5 font-semibold" style={{ color: THEME.textPrimary }}>{c.name}</td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-1 text-xs" style={{ color: THEME.textSecondary }}>
                      {c.category_color && <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: c.category_color }} />}
                      {c.category_name || '—'}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-sm" style={{ color: THEME.textSecondary }}>{c.contact_name || '—'}</td>
                  <td className="px-2 py-2.5 text-xs truncate max-w-[180px]" style={{ color: THEME.textSecondary }}>{email || '—'}</td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: THEME.textSecondary }}>{phone || '—'}</td>
                  <td className="px-2 py-2.5"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-2 py-2.5 text-xs font-mono" style={{ color: overdue ? '#ef4444' : THEME.textSecondary }}>
                    {c.follow_up_date ? new Date(c.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: THEME.textMuted }}>{formatRelativeTime(c.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
