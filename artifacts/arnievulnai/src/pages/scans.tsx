import { useListScanResults, getArtifactDownloadUrl } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatBytes, formatDate } from "@/lib/utils";
import { Cpu, FileText, Download, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Scans() {
  const { data: scans, isLoading, error } = useListScanResults();
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownload = async (key: string) => {
    try {
      setDownloading(key);
      // Backend handles getting presigned URL from the scan-results folder
      const res = await getArtifactDownloadUrl("scan-results", key);
      window.open(res.url, "_blank");
    } catch (err: any) {
      toast({
        title: "Download Failed",
        description: err.message || "Failed to generate presigned URL",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Layout title="Scan Results">
      <div className="space-y-6">
        
        <div className="soc-card p-6 flex flex-col md:flex-row gap-4 items-center justify-between border-primary/20 bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-full text-primary shadow-[0_0_15px_rgba(14,165,233,0.3)]">
              <Cpu className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Historical Scans</h3>
              <p className="text-primary/70 text-sm font-mono mt-1">s3://arnievulnai-artifacts/scan-results/</p>
            </div>
          </div>
          <button className="soc-button" onClick={() => toast({ title: "Trigger Scan", description: "Manual scan trigger queued via SNS." })}>
            Trigger New Scan
          </button>
        </div>

        <div className="soc-card overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div></div>
          ) : error ? (
            <div className="p-8 text-center text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>Failed to load scan results</p>
            </div>
          ) : scans?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No scan results found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-black/40 border-b border-border font-mono">
                  <tr>
                    <th className="px-4 py-3">Report Name</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Generated At</th>
                    <th className="px-4 py-3 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {scans?.map((scan) => (
                    <tr key={scan.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-4 font-mono text-sm text-white flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary/60" />
                        {scan.key}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                        {formatBytes(scan.size)}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDate(scan.lastModified)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleDownload(scan.key)}
                          disabled={downloading === scan.key}
                          className="soc-button-secondary py-1.5 h-8 text-xs hover:text-primary hover:border-primary/50"
                        >
                          {downloading === scan.key ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-primary mr-1" />
                          ) : (
                            <Download className="w-3 h-3 mr-1" />
                          )}
                          Report
                        </button>
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
