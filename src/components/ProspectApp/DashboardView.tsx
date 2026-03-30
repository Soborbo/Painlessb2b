import { useState, useEffect, useRef } from 'react';
import { BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react';
import { STATUS_CONFIG } from '../../lib/constants';
import { THEME } from '../../lib/site-config';
import { formatRelativeTime } from '../../lib/utils';

interface AnalyticsData {
  statusCounts: { status: string; count: number }[];
  categoryCounts: { name: string; color: string | null; count: number }[];
  priorityCounts: { priority: string; count: number }[];
  monthlyCreated: { month: string; count: number }[];
  emailStats: { status: string; count: number }[];
  recentActivity: { id: string; company_id: string | null; action: string; details: string | null; created_at: string; company_name: string | null }[];
  conversionFunnel: { total: number; contacted_plus: number; engaged: number; in_conversation_plus: number; partners: number };
}

export default function DashboardView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch('/api/analytics', { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { if (err?.name !== 'AbortError') { setLoading(false); setError(true); } });

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-[10px]" style={{ backgroundColor: THEME.elevated }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: THEME.textSecondary }}>Failed to load analytics data.</p>
      </div>
    );
  }

  const sentEmails = data.emailStats.find((e) => e.status === 'sent')?.count || 0;
  const total = data.conversionFunnel.total || 1;
  const funnel = data.conversionFunnel;

  const funnelSteps = [
    { label: 'Total Prospects', count: funnel.total, color: '#3b82f6' },
    { label: 'Contacted+', count: funnel.contacted_plus, color: '#f59e0b' },
    { label: 'Engaged', count: funnel.engaged, color: '#f97316' },
    { label: 'In Conversation+', count: funnel.in_conversation_plus, color: '#8b5cf6' },
    { label: 'Partners', count: funnel.partners, color: '#10b981' },
  ];

  const maxMonthly = Math.max(...data.monthlyCreated.map((m) => m.count), 1);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard icon={<BarChart3 size={20} />} label="Total Prospects" value={funnel.total} color="#3b82f6" />
        <SummaryCard icon={<TrendingUp size={20} />} label="Partners" value={funnel.partners} color="#10b981" />
        <SummaryCard icon={<PieChart size={20} />} label="Conversion Rate" value={funnel.total > 0 ? `${Math.round((funnel.partners / funnel.total) * 100)}%` : '0%'} color="#8b5cf6" />
        <SummaryCard icon={<Activity size={20} />} label="Emails Sent" value={sentEmails} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Conversion funnel */}
        <div className="rounded-[10px] p-5" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: THEME.textPrimary }}>Conversion Funnel</h3>
          <div className="space-y-3">
            {funnelSteps.map((step) => (
              <div key={step.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: THEME.textSecondary }}>{step.label}</span>
                  <span className="font-mono" style={{ color: THEME.textPrimary }}>{step.count}</span>
                </div>
                <div className="h-6 rounded-full overflow-hidden" style={{ backgroundColor: THEME.elevated }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: step.color,
                      width: `${Math.max(2, (step.count / total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status distribution */}
        <div className="rounded-[10px] p-5" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: THEME.textPrimary }}>Status Distribution</h3>
          <div className="space-y-2">
            {data.statusCounts.map((s) => {
              const cfg = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG];
              if (!cfg) return null;
              return (
                <div key={s.status} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <span className="text-sm flex-1" style={{ color: THEME.textPrimary }}>{cfg.label}</span>
                  <span className="text-sm font-mono" style={{ color: THEME.textSecondary }}>{s.count}</span>
                  <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: THEME.elevated }}>
                    <div className="h-full rounded-full" style={{ backgroundColor: cfg.color, width: `${(s.count / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly prospects (bar chart) */}
        <div className="rounded-[10px] p-5" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: THEME.textPrimary }}>Monthly New Prospects</h3>
          {data.monthlyCreated.length === 0 ? (
            <p className="text-xs" style={{ color: THEME.textMuted }}>No data yet</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {data.monthlyCreated.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono" style={{ color: THEME.textMuted }}>{m.count}</span>
                  <div
                    className="w-full rounded-t-[3px] transition-all duration-300"
                    style={{
                      backgroundColor: THEME.accent,
                      height: `${Math.max(4, (m.count / maxMonthly) * 100)}%`,
                    }}
                  />
                  <span className="text-[9px] font-mono" style={{ color: THEME.textMuted }}>
                    {m.month.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="rounded-[10px] p-5" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: THEME.textPrimary }}>By Category</h3>
          <div className="space-y-2">
            {data.categoryCounts.map((cat) => (
              <div key={cat.name} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#6b7280' }} />
                <span className="text-sm flex-1" style={{ color: THEME.textPrimary }}>{cat.name}</span>
                <span className="text-sm font-mono" style={{ color: THEME.textSecondary }}>{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-[10px] p-5" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: THEME.textPrimary }}>Recent Activity</h3>
        {data.recentActivity.length === 0 ? (
          <p className="text-xs" style={{ color: THEME.textMuted }}>No activity recorded yet</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {data.recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 py-2" style={{ borderBottom: `1px solid ${THEME.border}` }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: THEME.accent }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: THEME.textPrimary }}>
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    {entry.company_name && (
                      <span className="text-xs truncate" style={{ color: THEME.textSecondary }}>
                        — {entry.company_name}
                      </span>
                    )}
                  </div>
                  {entry.details && (
                    <p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>{entry.details}</p>
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: THEME.textMuted }}>
                  {formatRelativeTime(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-[10px] p-4" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs uppercase tracking-wider" style={{ color: THEME.textMuted }}>{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color: THEME.textPrimary }}>{value}</div>
    </div>
  );
}
