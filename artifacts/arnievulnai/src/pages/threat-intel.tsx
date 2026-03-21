import { useState } from "react";
import { useVirusTotalLookup, useListArtifactsByFolder } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatBytes, formatDate } from "@/lib/utils";
import { AlertTriangle, Search, FileText, Download, CheckCircle, ShieldAlert, Target } from "lucide-react";

export default function ThreatIntel() {
  const [iocInput, setIocInput] = useState("");
  const [submittedIoc, setSubmittedIoc] = useState("");

  const { data: vtData, isLoading: vtLoading, error: vtError } = useVirusTotalLookup(
    { ioc: submittedIoc },
    { query: { enabled: !!submittedIoc, retry: false } }
  );

  const { data: files } = useListArtifactsByFolder("threat-intel");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (iocInput.trim()) setSubmittedIoc(iocInput.trim());
  };

  return (
    <Layout title="Threat Intelligence">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* VT Lookup Form */}
        <div className="soc-card p-6 flex flex-col border-t-4 border-t-red-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-red-500/20 text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">VirusTotal Lookup</h3>
              <p className="text-xs text-muted-foreground font-mono">Query IP, Domain, or File Hash</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 mb-8">
            <input 
              type="text" 
              placeholder="e.g. 8.8.8.8 or md5 hash..." 
              className="soc-input flex-1 font-mono"
              value={iocInput}
              onChange={(e) => setIocInput(e.target.value)}
            />
            <button type="submit" className="soc-button bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)]">
              <Search className="w-4 h-4 mr-2" />
              Analyze
            </button>
          </form>

          {/* Results Area */}
          <div className="flex-1 bg-black/30 rounded-lg border border-border/50 p-4">
            {vtLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-red-500">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-500 mb-4"></div>
                <p className="font-mono text-xs animate-pulse">Querying VirusTotal API...</p>
              </div>
            ) : vtError ? (
              <div className="text-destructive text-center py-8">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Lookup failed or IOC not found.</p>
              </div>
            ) : vtData ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <span className="font-mono font-bold text-white break-all">{vtData.ioc}</span>
                  <span className="text-xs font-mono px-2 py-1 bg-white/10 rounded">{vtData.iocType.toUpperCase()}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded flex flex-col items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-red-500 mb-1" />
                    <span className="text-2xl font-bold text-red-500">{vtData.malicious}</span>
                    <span className="text-xs text-red-500/70 font-mono uppercase">Malicious</span>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded flex flex-col items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mb-1" />
                    <span className="text-2xl font-bold text-emerald-500">{vtData.harmless}</span>
                    <span className="text-xs text-emerald-500/70 font-mono uppercase">Harmless</span>
                  </div>
                </div>

                {vtData.tags && vtData.tags.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground mb-2 font-mono uppercase">Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {vtData.tags.map(tag => (
                        <span key={tag} className="text-xs font-mono px-2 py-0.5 bg-white/5 border border-white/10 rounded text-gray-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {vtData.permalink && (
                  <a href={vtData.permalink} target="_blank" rel="noreferrer" className="block w-full text-center py-2 mt-4 text-xs font-mono text-blue-400 hover:text-blue-300 border border-blue-900 rounded bg-blue-950/20 transition-colors">
                    View full report on VirusTotal ↗
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                <Target className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">Enter an IOC above to scan against VT</p>
              </div>
            )}
          </div>
        </div>

        {/* Local Threat Intel Artifacts */}
        <div className="soc-card p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Stored Intel Reports</h3>
              <p className="text-xs text-muted-foreground font-mono">s3://arnievulnai-artifacts/threat-intel/</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {!files ? (
               <div className="animate-pulse space-y-2">
                 {[1,2,3].map(i => <div key={i} className="h-12 bg-white/5 rounded"></div>)}
               </div>
            ) : files.length === 0 ? (
               <p className="text-center text-muted-foreground py-8">No stored intel found.</p>
            ) : (
              files.map(file => (
                <div key={file.key} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 hover:bg-black/40 transition-colors group">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm text-blue-100">{file.key}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {formatDate(file.lastModified)} • {formatBytes(file.size)}
                    </span>
                  </div>
                  <Link href={`/artifacts/threat-intel`} className="text-muted-foreground hover:text-white transition-colors">
                    <Download className="w-4 h-4" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
