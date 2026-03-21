import { useParams, Link } from "wouter";
import { useListArtifactsByFolder, getArtifactDownloadUrl } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatBytes, formatDate } from "@/lib/utils";
import { Folder, FileText, Download, ArrowLeft, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ArtifactFolder() {
  const { folder } = useParams<{ folder: string }>();
  const { data: files, isLoading, error } = useListArtifactsByFolder(folder || "");
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownload = async (key: string) => {
    if (!folder) return;
    try {
      setDownloading(key);
      const res = await getArtifactDownloadUrl(folder, key);
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
    <Layout title={`Artifacts / ${folder}`}>
      <div className="space-y-4">
        
        <div className="flex items-center gap-4 mb-6">
          <Link href="/artifacts" className="soc-button-secondary py-1.5 h-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Folders
          </Link>
          <div className="flex items-center gap-2 text-lg font-mono text-blue-400">
            <Folder className="w-5 h-5" />
            <span>{folder}</span>
          </div>
        </div>

        <div className="soc-card overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div></div>
          ) : error ? (
            <div className="p-8 text-center text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>Failed to load files</p>
            </div>
          ) : files?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Folder is empty.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-black/40 border-b border-border font-mono">
                  <tr>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Last Modified</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {files?.map((file) => (
                    <tr key={file.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-blue-100 flex items-center gap-3">
                        <FileText className="w-4 h-4 text-blue-500/50" />
                        {file.key}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(file.lastModified)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDownload(file.key)}
                          disabled={downloading === file.key}
                          className="soc-button py-1 h-8 text-xs bg-blue-600 hover:bg-blue-500"
                        >
                          {downloading === file.key ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-1" />
                          ) : (
                            <Download className="w-3 h-3 mr-1" />
                          )}
                          Download
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
