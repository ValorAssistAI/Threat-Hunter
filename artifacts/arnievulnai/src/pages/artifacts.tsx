import { useListArtifactFolders } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { HardDrive, FolderOpen, Clock, AlertCircle } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";

export default function Artifacts() {
  const { data: folders, isLoading, error } = useListArtifactFolders();

  return (
    <Layout title="S3 Artifacts">
      <div className="space-y-6">
        <div className="soc-card p-6 flex flex-col md:flex-row gap-4 items-center justify-between border-blue-500/20 bg-blue-950/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-full text-blue-400">
              <HardDrive className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">arnievulnai-artifacts</h3>
              <p className="text-blue-400/70 text-sm font-mono mt-1">us-east-1 // secure storage</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div></div>
        ) : error ? (
          <div className="p-8 text-center text-destructive flex flex-col items-center gap-2 soc-card">
            <AlertCircle className="w-8 h-8" />
            <p>Failed to load folders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {folders?.map((folder) => (
              <Link key={folder.name} href={`/artifacts/${folder.name}`} className="block group">
                <div className="soc-card p-6 hover:-translate-y-1 hover:shadow-xl transition-all border-l-4 hover:border-l-blue-500 cursor-pointer h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <FolderOpen className="w-8 h-8 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    <span className="font-mono text-xs px-2.5 py-1 bg-white/5 rounded-full text-muted-foreground border border-white/10">
                      {folder.count} files
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">{folder.name}</h3>
                  
                  <div className="mt-auto pt-4 flex items-center gap-2 text-xs text-muted-foreground font-mono border-t border-border/50">
                    <Clock className="w-3 h-3" />
                    Last updated: {formatTimeAgo(folder.lastModified)}
                  </div>
                </div>
              </Link>
            ))}
            {folders?.length === 0 && (
               <div className="col-span-full p-12 text-center text-muted-foreground soc-card">
                 <p>No artifact folders found.</p>
               </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
