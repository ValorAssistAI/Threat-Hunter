export interface ScopeDefinition {
  inTargets: string[];
  outTargets: string[];
  conditions: string;
}

function normalize(t: string): string {
  return t.toLowerCase().trim();
}

function matchesTarget(value: string, targets: string[]): boolean {
  const v = normalize(value);
  return targets.some((t) => {
    const n = normalize(t);
    if (n === v) return true;
    if (n === "*") return true;
    // CIDR-ish prefix check
    if (n.endsWith("*") && v.startsWith(n.slice(0, -1))) return true;
    // suffix domain match (e.g. *.example.com)
    if (n.startsWith("*.") && v.endsWith(n.slice(1))) return true;
    return false;
  });
}

export interface ScopeCheckResult {
  allowed: boolean;
  reason: string;
}

export function checkScope(
  toolName: string,
  input: Record<string, unknown>,
  scope: ScopeDefinition
): ScopeCheckResult {
  const { inTargets, outTargets } = scope;

  // Extract the primary target/resource from the tool input
  const targets: string[] = [];

  if (input.target) targets.push(String(input.target));
  if (input.ioc) targets.push(String(input.ioc));
  if (input.folder) targets.push(String(input.folder));
  if (input.logGroup) targets.push(String(input.logGroup));
  if (input.accountId) targets.push(String(input.accountId));
  if (input.resource) targets.push(String(input.resource));

  // Read-only AWS tools — always allowed if account is in scope
  const awsReadOnlyTools = [
    "guardduty_list_findings",
    "inspector_list_findings",
    "securityhub_list_findings",
    "cloudwatch_get_logs",
    "cloudwatch_list_groups",
    "s3_list_files",
    "s3_get_file",
    "dashboard_summary",
  ];

  const vtTools = ["virustotal_lookup"];

  // If no specific targets extracted, check if it's a tool allowed by wildcard scope
  if (targets.length === 0) {
    if (awsReadOnlyTools.includes(toolName)) {
      // Allow if AWS account is in scope
      const awsAccountInScope = inTargets.some((t) =>
        /^\d{12}$/.test(t.trim()) || normalize(t) === "aws" || normalize(t) === "*"
      );
      if (awsAccountInScope) {
        return { allowed: true, reason: "AWS account is in scope" };
      }
      return { allowed: false, reason: `Tool '${toolName}' requires an AWS account or resource to be listed in scope` };
    }
    if (vtTools.includes(toolName)) {
      return { allowed: true, reason: "VirusTotal lookups are always permitted for threat intel" };
    }
    return { allowed: true, reason: "No specific target restriction applies" };
  }

  // Check each target against out-of-scope list first (deny wins)
  for (const t of targets) {
    if (outTargets.length > 0 && matchesTarget(t, outTargets)) {
      return {
        allowed: false,
        reason: `Target '${t}' is explicitly out of scope`,
      };
    }
  }

  // Check in-scope
  if (inTargets.length > 0) {
    for (const t of targets) {
      if (matchesTarget(t, inTargets)) {
        return { allowed: true, reason: `Target '${t}' is in scope` };
      }
    }
    return {
      allowed: false,
      reason: `Target(s) [${targets.join(", ")}] are not in the defined scope`,
    };
  }

  return { allowed: true, reason: "No scope restrictions apply to this target" };
}
