import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  ShieldAlert, 
  Activity, 
  Search, 
  HardDrive, 
  TerminalSquare, 
  Target, 
  Shield, 
  AlertTriangle,
  Cpu,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/guardduty", label: "GuardDuty", icon: ShieldAlert },
    { href: "/inspector", label: "Inspector v2", icon: Search },
    { href: "/security-hub", label: "Security Hub", icon: Target },
    { href: "/artifacts", label: "S3 Artifacts", icon: HardDrive },
    { href: "/logs", label: "CloudWatch Logs", icon: TerminalSquare },
    { href: "/threat-intel", label: "Threat Intel", icon: AlertTriangle },
    { href: "/scans", label: "Scan Results", icon: Cpu },
    { href: "/agent", label: "Autonomous Agent", icon: Bot },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-64 glass-panel border-r border-white/5 flex-shrink-0 z-20 flex flex-col h-auto md:h-screen md:sticky md:top-0">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/50 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(14,165,233,0.3)]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-tight">ArnieAI</h1>
            <p className="text-xs text-primary font-mono tracking-wider">VULNERABILITY AGENT</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                    isActive 
                      ? "text-white bg-primary/10 border border-primary/20" 
                      : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
                  )}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full shadow-[0_0_10px_rgba(14,165,233,1)]" />
                  )}
                  <Icon className={cn("w-5 h-5 z-10 transition-colors", isActive ? "text-primary" : "group-hover:text-primary/70")} />
                  <span className="z-10">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-white/5 text-xs text-muted-foreground font-mono flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
          SYSTEM ONLINE - US-EAST-1
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 flex items-center px-6 glass-panel border-b border-white/5 z-10 flex-shrink-0 sticky top-0 justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{title || "Dashboard"}</h2>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm font-mono text-muted-foreground bg-black/20 px-3 py-1.5 rounded-md border border-white/5">
              <span>Account:</span>
              <span className="text-white">973028704465</span>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          {/* Subtle background image overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" 
               style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/soc-bg.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 w-full max-w-7xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
