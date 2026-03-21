import { useState } from "react";
import { useListGuardDutyFindings } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { SeverityBadge } from "@/components/severity-badge";
import { formatDate } from "@/lib/utils";
import { ShieldAlert, Filter, AlertCircle } from "lucide-react";

export default function GuardDuty() {
  const [severity, setSeverity] = useState<string>("");
  const { data: findings, isLoading, error } = useListGuardDutyFindings({ severity: severity || undefined });

  return (
    <Layout title="GuardDuty Findings">
      <div className="space-y-6">
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 soc-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Detector: active</span>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select 
              className="soc-input w-full sm:w-48"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="high">High (7.0 - 8.9)</option>
              <option value="medium">Medium (4.0 - 6.9)</option>
              <option value="low">Low (0.1 - 3.9)</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="soc-card overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div></div>
          ) : error ? (
            <div className="p-8 text-center text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>Failed to load findings</p>
            </div>
          ) : findings?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No GuardDuty findings detected matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-black/40 border-b border-border font-mono">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">Region</th>
                    <th className="px-4 py-3 text-right">Count</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {findings?.map((finding) => (
                    <tr key={finding.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SeverityBadge severity={finding.severityLabel} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-300 max-w-xs truncate" title={finding.type}>
                        {finding.type}
                        <div className="text-muted-foreground text-[10px] mt-1 truncate" title={finding.title}>
                          {finding.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {finding.resourceType || "Unknown"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {finding.region}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {finding.count}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(finding.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
