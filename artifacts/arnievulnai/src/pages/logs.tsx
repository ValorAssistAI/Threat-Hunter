import { useState } from "react";
import { useListLogGroups, useGetLogEvents } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatDate } from "@/lib/utils";
import { TerminalSquare, RefreshCw, AlertCircle } from "lucide-react";

export default function Logs() {
  const [selectedGroup, setSelectedGroup] = useState<string>("/arnievulnai/tool-invocations");
  const { data: groups, isLoading: loadingGroups } = useListLogGroups();
  
  const { data: events, isLoading: loadingEvents, error, refetch } = useGetLogEvents(
    { group: selectedGroup, limit: 100 },
    { query: { enabled: !!selectedGroup } }
  );

  return (
    <Layout title="CloudWatch Logs">
      <div className="space-y-4 flex flex-col h-[calc(100vh-8rem)]">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 soc-card p-4 flex-shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <TerminalSquare className="w-5 h-5 text-cyan-500" />
            {loadingGroups ? (
               <div className="animate-pulse bg-white/10 h-10 w-64 rounded"></div>
            ) : (
              <select 
                className="soc-input w-full sm:w-80 font-mono text-sm focus-visible:ring-cyan-500"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                {groups?.map(g => (
                  <option key={g.name} value={g.name}>{g.name}</option>
                ))}
              </select>
            )}
          </div>
          
          <button 
            onClick={() => refetch()} 
            disabled={loadingEvents}
            className="soc-button-secondary bg-black/40 hover:bg-black/60"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingEvents ? 'animate-spin' : ''}`} />
            Refresh Stream
          </button>
        </div>

        <div className="soc-card flex-1 flex flex-col overflow-hidden bg-[#0A0A0A] border-cyan-900/30">
          <div className="px-4 py-2 border-b border-border/50 bg-black/40 flex justify-between items-center flex-shrink-0">
            <span className="text-xs font-mono text-cyan-500">Live Log Stream</span>
            <span className="text-xs font-mono text-muted-foreground">{events?.length || 0} events loaded</span>
          </div>

          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-gray-300">
            {loadingEvents && !events ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500"></div>
              </div>
            ) : error ? (
               <div className="text-destructive flex items-center gap-2 justify-center h-full">
                 <AlertCircle className="w-5 h-5" /> Failed to load log stream
               </div>
            ) : events?.length === 0 ? (
               <div className="text-muted-foreground text-center pt-12">No log events found for this group.</div>
            ) : (
              <div className="space-y-1.5">
                {events?.map((ev, i) => (
                  <div key={i} className="flex gap-4 hover:bg-white/5 px-2 py-1 rounded transition-colors group">
                    <div className="text-cyan-600/70 whitespace-nowrap flex-shrink-0 select-none">
                      {formatDate(ev.timestamp)}
                    </div>
                    <div className="break-all whitespace-pre-wrap text-emerald-400/90 group-hover:text-emerald-300">
                      {ev.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
