import { useState } from "react";
import { useListInspectorFindings } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { SeverityBadge } from "@/components/severity-badge";
import { formatDate } from "@/lib/utils";
import { Search, Filter, AlertCircle, Box } from "lucide-react";

export default function Inspector() {
  const [severity, setSeverity] = useState<string>("");
  const { data: findings, isLoading, error } = useListInspectorFindings({ severity: severity || undefined });

  return (
    <Layout title="Inspector v2 Findings">
      <div className="space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 soc-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium">Scans: EC2 / ECR / Lambda</span>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select 
              className="soc-input w-full sm:w-48 focus-visible:ring-purple-500"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div className="soc-card overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500"></div></div>
          ) : error ? (
            <div className="p-8 text-center text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>Failed to load findings</p>
            </div>
          ) : findings?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Box className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No vulnerabilities found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-black/40 border-b border-border font-mono">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Vulnerability</th>
                    <th className="px-4 py-3">CVSS</th>
                    <th className="px-4 py-3">Resource ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Found At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {findings?.map((finding) => (
                    <tr key={finding.arn} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SeverityBadge severity={finding.severity} />
                      </td>
                      <td className="px-4 py-3 max-w-sm">
                        <div className="font-semibold text-white truncate" title={finding.title}>
                          {finding.title}
                        </div>
                        {finding.cveId && (
                          <div className="text-xs font-mono text-purple-400 mt-1">
                            {finding.cveId}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        {finding.cvssScore !== null ? (
                          <span className={finding.cvssScore >= 7 ? "text-destructive" : "text-yellow-500"}>
                            {finding.cvssScore.toFixed(1)}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate" title={finding.resourceId || ""}>
                        <div className="text-muted-foreground uppercase text-[10px] mb-0.5">{finding.resourceType}</div>
                        {finding.resourceId}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/5 border border-white/10">
                          {finding.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(finding.createdAt)}
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
