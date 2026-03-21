import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ShieldAlert, Search, Target, HardDrive, AlertCircle, ShieldCheck, ActivitySquare } from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";
import { formatTimeAgo } from "@/lib/utils";

export default function Dashboard() {
  const { data, isLoading, error } = useGetDashboardSummary();

  if (isLoading) return (
    <Layout title="Dashboard">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    </Layout>
  );

  if (error || !data) return (
    <Layout title="Dashboard">
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive flex items-center gap-3">
        <AlertCircle className="w-6 h-6" />
        <p>Failed to load dashboard summary. Ensure backend is running.</p>
      </div>
    </Layout>
  );

  const StatCard = ({ title, icon: Icon, summary, colorClass }: any) => (
    <div className="soc-card p-6 flex flex-col relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className={`w-24 h-24 ${colorClass}`} />
      </div>
      
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className={`p-2 rounded-lg bg-black/40 border border-white/5 ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className={`ml-auto px-2 py-0.5 rounded text-xs font-mono font-bold border ${
          summary.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
          'bg-muted text-muted-foreground border-border'
        }`}>
          {summary.status.toUpperCase()}
        </div>
      </div>
      
      <div className="mb-4 relative z-10">
        <div className="text-4xl font-bold tracking-tight font-mono">{summary.total}</div>
        <div className="text-sm text-muted-foreground">Total Findings</div>
      </div>
      
      <div className="grid grid-cols-4 gap-2 mt-auto relative z-10 border-t border-border/50 pt-4">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase">Crit</span>
          <span className="font-mono font-bold text-destructive">{summary.critical}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase">High</span>
          <span className="font-mono font-bold text-orange-500">{summary.high}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase">Med</span>
          <span className="font-mono font-bold text-yellow-500">{summary.medium}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase">Low</span>
          <span className="font-mono font-bold text-blue-500">{summary.low}</span>
        </div>
      </div>
    </div>
  );

  return (
    <Layout title="SOC Overview">
      <div className="space-y-6">
        
        {/* Security Services Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard title="GuardDuty" icon={ShieldAlert} summary={data.guardduty} colorClass="text-primary" />
          <StatCard title="Inspector v2" icon={Search} summary={data.inspector} colorClass="text-purple-500" />
          <StatCard title="Security Hub" icon={Target} summary={data.securityhub} colorClass="text-emerald-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Artifacts Summary */}
          <div className="lg:col-span-1 soc-card p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
              <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-blue-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg">S3 Artifacts</h3>
            </div>
            <div className="text-sm text-muted-foreground mb-4 font-mono">{data.s3.bucket}</div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {data.s3.folders.map(folder => (
                <div key={folder.name} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                  <span className="font-medium text-sm text-blue-100">{folder.name}</span>
                  <span className="font-mono text-xs px-2 py-1 bg-white/5 rounded text-muted-foreground">
                    {folder.count} items
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2 soc-card p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
              <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-primary">
                <ActivitySquare className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg">Recent Threat Activity</h3>
            </div>
            
            <div className="space-y-4 overflow-y-auto pr-2">
              {data.recentActivity.map(activity => (
                <div key={activity.id} className="flex gap-4 items-start p-3 rounded-lg hover:bg-black/20 transition-colors border border-transparent hover:border-white/5">
                  <div className="mt-1">
                    {activity.severity.includes('CRITICAL') || activity.severity.includes('HIGH') ? (
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-muted-foreground uppercase">{activity.source}</span>
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                    <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                  </div>
                  <div>
                    <SeverityBadge severity={activity.severity} />
                  </div>
                </div>
              ))}
              {data.recentActivity.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ShieldCheck className="w-12 h-12 mb-3 opacity-20" />
                  <p>No recent activity detected.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
