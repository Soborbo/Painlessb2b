import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { STATUS_CONFIG } from '../../lib/constants';
import { THEME } from '../../lib/site-config';
import { formatRelativeTime } from '../../lib/utils';
import type { Company } from './types';
import PriorityBadge from './PriorityBadge';

interface Props {
  companies: Company[];
  totalCount: number;
  onSelectCompany: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
}

type ColKey = 'name' | 'status' | 'category_name' | 'priority' | 'follow_up' | 'updated';

function isOverdue(c: Company): boolean {
  if (!c.follow_up_date) return false;
  if (['partner', 'rejected', 'not_interested'].includes(c.status)) return false;
  return new Date(c.follow_up_date) <= new Date();
}

export default function ListView({ companies, totalCount, onSelectCompany, selectedIds, onToggleSelect, onSelectAll }: Props) {
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

  const allSelected = companies.length > 0 && companies.every((c) => selectedIds.has(c.id));
  const someSelected = companies.some((c) => selectedIds.has(c.id));

  const handleSelectAllToggle = () => {
    if (allSelected) {
      onSelectAll([]);
    } else {
      onSelectAll(companies.map((c) => c.id));
    }
  };

  const SortIcon = ({ col }: { col: ColKey }) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 text-xs font-mono" style={{ color: THEME.textSecondary }}>
        Showing {companies.length} of {totalCount} prospects
        {selectedIds.size > 0 && (
          <span style={{ color: THEME.accent }}> ({selectedIds.size} selected)</span>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ backgroundColor: THEME.surface }}>
              {/* Checkbox */}
              <th className="w-[40px] px-2 py-2" style={{ borderBottom: `1px solid ${THEME.border}` }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={handleSelectAllToggle}
                  className="cursor-pointer"
                />
              </th>
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
              const isSelected = selectedIds.has(c.id);

              return (
                <tr
                  key={c.id}
                  className="cursor-pointer transition-colors duration-150"
                  style={{
                    backgroundColor: isSelected ? THEME.accent + '10' : (i % 2 === 0 ? 'transparent' : THEME.elevated),
                  }}
                >
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(c.id)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-2.5" onClick={() => onSelectCompany(c.id)}>
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: statusColor }} />
                  </td>
                  <td className="px-2 py-2.5 font-semibold" style={{ color: THEME.textPrimary }} onClick={() => onSelectCompany(c.id)}>{c.name}</td>
                  <td className="px-2 py-2.5" onClick={() => onSelectCompany(c.id)}>
                    <span className="flex items-center gap-1 text-xs" style={{ color: THEME.textSecondary }}>
                      {c.category_color && <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: c.category_color }} />}
                      {c.category_name || '—'}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-sm" style={{ color: THEME.textSecondary }} onClick={() => onSelectCompany(c.id)}>{c.contact_name || '—'}</td>
                  <td className="px-2 py-2.5 text-xs truncate max-w-[180px]" style={{ color: THEME.textSecondary }} onClick={() => onSelectCompany(c.id)}>{email || '—'}</td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: THEME.textSecondary }} onClick={() => onSelectCompany(c.id)}>{phone || '—'}</td>
                  <td className="px-2 py-2.5" onClick={() => onSelectCompany(c.id)}><PriorityBadge priority={c.priority} /></td>
                  <td className="px-2 py-2.5 text-xs font-mono" style={{ color: overdue ? '#ef4444' : THEME.textSecondary }} onClick={() => onSelectCompany(c.id)}>
                    {c.follow_up_date ? new Date(c.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: THEME.textMuted }} onClick={() => onSelectCompany(c.id)}>{formatRelativeTime(c.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
