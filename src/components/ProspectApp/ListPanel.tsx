import { useMemo } from 'react';
import type { Company, SortBy } from './types';
import ProspectCard from './ProspectCard';

interface Props {
  companies: Company[];
  totalCount: number;
  selectedCompanyId: string | null;
  onSelectCompany: (id: string) => void;
  sortBy: SortBy;
  sortDir: 'asc' | 'desc';
  onSortChange: (by: SortBy) => void;
}

function sortCompanies(companies: Company[], sortBy: SortBy, sortDir: 'asc' | 'desc'): Company[] {
  const sorted = [...companies].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'priority': {
        const order = { high: 0, medium: 1, low: 2 };
        cmp = (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
        break;
      }
      case 'updated':
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        break;
      case 'follow_up': {
        const aDate = a.follow_up_date ? new Date(a.follow_up_date).getTime() : Infinity;
        const bDate = b.follow_up_date ? new Date(b.follow_up_date).getTime() : Infinity;
        cmp = aDate - bDate;
        break;
      }
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'follow_up', label: 'Follow-up Date' },
];

export default function ListPanel({ companies, totalCount, selectedCompanyId, onSelectCompany, sortBy, sortDir, onSortChange }: Props) {
  const sorted = useMemo(() => sortCompanies(companies, sortBy, sortDir), [companies, sortBy, sortDir]);

  return (
    <div
      className="w-[380px] flex-shrink-0 flex flex-col h-full"
      style={{ backgroundColor: '#13151e', borderLeft: '1px solid #2a2d42' }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #2a2d42' }}>
        <span className="text-xs font-mono" style={{ color: '#8990b0' }}>
          Showing {companies.length} of {totalCount} prospects
        </span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortBy)}
          className="text-xs rounded px-2 py-1 outline-none cursor-pointer"
          style={{ backgroundColor: '#1a1d2a', border: '1px solid #2a2d42', color: '#e8eaf4' }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((company) => (
          <ProspectCard
            key={company.id}
            company={company}
            selected={company.id === selectedCompanyId}
            onClick={() => onSelectCompany(company.id)}
          />
        ))}
      </div>
    </div>
  );
}
