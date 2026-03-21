import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: string | number;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  // Handle numeric GuardDuty severities (0.1 to 8.9+)
  let label = String(severity).toUpperCase();
  let normalizedSeverity = label;

  if (typeof severity === 'number' || !isNaN(Number(severity))) {
    const num = Number(severity);
    if (num >= 7.0) { normalizedSeverity = "HIGH"; label = "HIGH"; }
    else if (num >= 4.0) { normalizedSeverity = "MEDIUM"; label = "MEDIUM"; }
    else { normalizedSeverity = "LOW"; label = "LOW"; }
  }

  // Handle standard string severities
  const isCritical = normalizedSeverity.includes("CRITICAL");
  const isHigh = normalizedSeverity.includes("HIGH");
  const isMedium = normalizedSeverity.includes("MEDIUM");
  const isLow = normalizedSeverity.includes("LOW");
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono tracking-wider border",
      isCritical && "bg-destructive/10 text-destructive border-destructive/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
      isHigh && "bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.2)]",
      isMedium && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      isLow && "bg-blue-500/10 text-blue-500 border-blue-500/20",
      (!isCritical && !isHigh && !isMedium && !isLow) && "bg-muted text-muted-foreground border-border",
      className
    )}>
      {label}
    </span>
  );
}
