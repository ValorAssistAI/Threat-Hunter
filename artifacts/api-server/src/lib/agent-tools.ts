import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import {
  ListDetectorsCommand,
  ListFindingsCommand,
  GetFindingsCommand,
} from "@aws-sdk/client-guardduty";
import { ListFindingsCommand as InspectorListFindings } from "@aws-sdk/client-inspector2";
import { GetFindingsCommand as SHGetFindings } from "@aws-sdk/client-securityhub";
import {
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { GetLogEventsCommand, DescribeLogGroupsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import {
  guarddutyClient,
  inspectorClient,
  securityhubClient,
  s3Client,
  cloudwatchClient,
  secretsClient,
  S3_BUCKET,
} from "./aws";

export const AGENT_TOOLS: Tool[] = [
  {
    name: "guardduty_list_findings",
    description:
      "List GuardDuty security findings from the AWS account. Returns findings with severity, type, resource, and description.",
    input_schema: {
      type: "object" as const,
      properties: {
        maxResults: {
          type: "number",
          description: "Maximum number of findings to return (default 20, max 50)",
        },
        accountId: {
          type: "string",
          description: "The AWS account ID being analyzed (for scope validation)",
        },
      },
      required: [],
    },
  },
  {
    name: "inspector_list_findings",
    description:
      "List AWS Inspector v2 vulnerability findings including CVE IDs, CVSS scores, affected resources, and severity.",
    input_schema: {
      type: "object" as const,
      properties: {
        maxResults: {
          type: "number",
          description: "Maximum number of findings to return (default 20, max 100)",
        },
        accountId: {
          type: "string",
          description: "The AWS account ID being analyzed (for scope validation)",
        },
      },
      required: [],
    },
  },
  {
    name: "securityhub_list_findings",
    description:
      "List AWS Security Hub aggregated findings across all connected security services.",
    input_schema: {
      type: "object" as const,
      properties: {
        maxResults: {
          type: "number",
          description: "Maximum number of findings to return (default 20, max 100)",
        },
        accountId: {
          type: "string",
          description: "The AWS account ID being analyzed (for scope validation)",
        },
      },
      required: [],
    },
  },
  {
    name: "s3_list_files",
    description:
      "List files in a specific folder of the arnievulnai-artifacts S3 bucket. Folders: reports, scan-results, audit, samples, threat-intel.",
    input_schema: {
      type: "object" as const,
      properties: {
        folder: {
          type: "string",
          enum: ["reports", "scan-results", "audit", "samples", "threat-intel"],
          description: "The S3 folder to list",
        },
      },
      required: ["folder"],
    },
  },
  {
    name: "s3_get_file",
    description:
      "Read the contents of a text file from the arnievulnai-artifacts S3 bucket.",
    input_schema: {
      type: "object" as const,
      properties: {
        folder: {
          type: "string",
          description: "The S3 folder (e.g. 'reports')",
        },
        key: {
          type: "string",
          description: "The file key/name within the folder",
        },
      },
      required: ["folder", "key"],
    },
  },
  {
    name: "cloudwatch_list_groups",
    description: "List available CloudWatch log groups under /arnievulnai/.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "cloudwatch_get_logs",
    description:
      "Retrieve recent log events from a CloudWatch log group. Useful for audit trails, scan results, and tool invocation history.",
    input_schema: {
      type: "object" as const,
      properties: {
        logGroup: {
          type: "string",
          description:
            "Log group name (e.g. /arnievulnai/audit, /arnievulnai/scan-results, /arnievulnai/threat-intel, /arnievulnai/tool-invocations)",
        },
        limit: {
          type: "number",
          description: "Number of log events to retrieve (default 50, max 100)",
        },
      },
      required: ["logGroup"],
    },
  },
  {
    name: "virustotal_lookup",
    description:
      "Look up a file hash (MD5, SHA1, SHA256), IP address, or domain on VirusTotal to get malware analysis results.",
    input_schema: {
      type: "object" as const,
      properties: {
        ioc: {
          type: "string",
          description: "The indicator of compromise: file hash, IP address, or domain name",
        },
      },
      required: ["ioc"],
    },
  },
  {
    name: "dashboard_summary",
    description:
      "Get a high-level summary of all security services: GuardDuty, Inspector, Security Hub finding counts by severity, and S3 artifact counts.",
    input_schema: {
      type: "object" as const,
      properties: {
        accountId: {
          type: "string",
          description: "The AWS account ID being analyzed",
        },
      },
      required: [],
    },
  },
];

let cachedVTKey: string | null = null;

async function getVTApiKey(): Promise<string | null> {
  if (cachedVTKey) return cachedVTKey;
  const envKey = process.env.VIRUSTOTAL_API_KEY;
  if (envKey) { cachedVTKey = envKey; return cachedVTKey; }
  try {
    const res = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: "arnievulnai/virustotal-api-key" })
    );
    cachedVTKey = res.SecretString ?? null;
  } catch { /* ignore */ }
  return cachedVTKey;
}

function detectIocType(ioc: string): string {
  if (/^[a-fA-F0-9]{32}$/.test(ioc)) return "md5";
  if (/^[a-fA-F0-9]{40}$/.test(ioc)) return "sha1";
  if (/^[a-fA-F0-9]{64}$/.test(ioc)) return "sha256";
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ioc)) return "ip";
  return "domain";
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "dashboard_summary": {
      const [gdDet] = await Promise.allSettled([
        guarddutyClient.send(new ListDetectorsCommand({}))
      ]);
      let gdCount = 0;
      if (gdDet.status === "fulfilled") {
        const detId = gdDet.value.DetectorIds?.[0];
        if (detId) {
          const list = await guarddutyClient.send(new ListFindingsCommand({ DetectorId: detId, MaxResults: 50 }));
          gdCount = list.FindingIds?.length ?? 0;
        }
      }
      const [insp, sh] = await Promise.allSettled([
        inspectorClient.send(new InspectorListFindings({ maxResults: 100 })),
        securityhubClient.send(new SHGetFindings({ MaxResults: 100 })),
      ]);
      return {
        guardduty: { total: gdCount },
        inspector: { total: insp.status === "fulfilled" ? (insp.value.findings?.length ?? 0) : 0 },
        securityhub: { total: sh.status === "fulfilled" ? (sh.value.Findings?.length ?? 0) : 0 },
      };
    }

    case "guardduty_list_findings": {
      const detRes = await guarddutyClient.send(new ListDetectorsCommand({}));
      const detId = detRes.DetectorIds?.[0];
      if (!detId) return { findings: [], message: "No GuardDuty detector found" };
      const max = Math.min(Number(input.maxResults ?? 20), 50);
      const list = await guarddutyClient.send(new ListFindingsCommand({ DetectorId: detId, MaxResults: max }));
      if (!list.FindingIds?.length) return { findings: [], message: "No findings" };
      const get = await guarddutyClient.send(new GetFindingsCommand({ DetectorId: detId, FindingIds: list.FindingIds }));
      return {
        findings: (get.Findings ?? []).map((f) => ({
          id: f.Id,
          title: f.Title,
          type: f.Type,
          severity: f.Severity,
          resource: f.Resource?.ResourceType,
          accountId: f.AccountId,
          region: f.Region,
          count: f.Service?.Count,
        })),
      };
    }

    case "inspector_list_findings": {
      const max = Math.min(Number(input.maxResults ?? 20), 100);
      const res = await inspectorClient.send(new InspectorListFindings({ maxResults: max }));
      return {
        findings: (res.findings ?? []).map((f) => ({
          arn: f.findingArn,
          title: f.title,
          severity: f.severity,
          cve: f.packageVulnerabilityDetails?.vulnerabilityId,
          cvss: f.inspectorScore,
          status: f.status,
          resource: f.resources?.[0]?.id,
        })),
      };
    }

    case "securityhub_list_findings": {
      const max = Math.min(Number(input.maxResults ?? 20), 100);
      const res = await securityhubClient.send(new SHGetFindings({ MaxResults: max }));
      return {
        findings: (res.Findings ?? []).map((f) => ({
          id: f.Id,
          title: f.Title,
          severity: f.Severity?.Label,
          score: f.Severity?.Normalized,
          product: f.ProductName,
          status: f.Workflow?.Status,
          resource: f.Resources?.[0]?.Id,
        })),
      };
    }

    case "s3_list_files": {
      const folder = String(input.folder ?? "");
      const res = await s3Client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: `${folder}/`, MaxKeys: 100 }));
      const files = (res.Contents ?? [])
        .filter((o) => o.Key && o.Key !== `${folder}/`)
        .map((o) => ({ key: o.Key?.replace(`${folder}/`, ""), size: o.Size, lastModified: o.LastModified }));
      return { folder, files, total: files.length };
    }

    case "s3_get_file": {
      const folder = String(input.folder ?? "");
      const key = String(input.key ?? "");
      const res = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: `${folder}/${key}` }));
      const body = await res.Body?.transformToString();
      return { folder, key, content: body?.slice(0, 10000) ?? "(empty)", truncated: (body?.length ?? 0) > 10000 };
    }

    case "cloudwatch_list_groups": {
      const res = await cloudwatchClient.send(new DescribeLogGroupsCommand({ logGroupNamePrefix: "/arnievulnai" }));
      return { groups: (res.logGroups ?? []).map((g) => ({ name: g.logGroupName, storedBytes: g.storedBytes })) };
    }

    case "cloudwatch_get_logs": {
      const logGroup = String(input.logGroup ?? "");
      const limit = Math.min(Number(input.limit ?? 50), 100);
      const res = await cloudwatchClient.send(new GetLogEventsCommand({ logGroupName: logGroup, limit, startFromHead: false }));
      return {
        logGroup,
        events: (res.events ?? []).map((e) => ({
          timestamp: e.timestamp,
          message: e.message,
        })),
      };
    }

    case "virustotal_lookup": {
      const ioc = String(input.ioc ?? "").trim();
      const iocType = detectIocType(ioc);
      const apiKey = await getVTApiKey();
      if (!apiKey) return { error: "VirusTotal API key not configured" };

      let endpoint: string;
      if (["md5", "sha1", "sha256"].includes(iocType)) {
        endpoint = `https://www.virustotal.com/api/v3/files/${ioc}`;
      } else if (iocType === "ip") {
        endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${ioc}`;
      } else {
        endpoint = `https://www.virustotal.com/api/v3/domains/${ioc}`;
      }

      const vtRes = await fetch(endpoint, { headers: { "x-apikey": apiKey } });
      if (!vtRes.ok) return { error: `VirusTotal returned ${vtRes.status}` };
      const data = (await vtRes.json()) as { data?: { attributes?: Record<string, unknown> } };
      const attrs = data?.data?.attributes ?? {};
      const stats = (attrs.last_analysis_stats ?? {}) as Record<string, number>;
      return {
        ioc, iocType,
        malicious: stats.malicious ?? 0,
        suspicious: stats.suspicious ?? 0,
        undetected: stats.undetected ?? 0,
        harmless: stats.harmless ?? 0,
        total: Object.values(stats).reduce((a, b) => a + b, 0),
        reputation: attrs.reputation,
        tags: attrs.tags ?? [],
        permalink: iocType === "ip"
          ? `https://www.virustotal.com/gui/ip-address/${ioc}`
          : iocType === "domain"
          ? `https://www.virustotal.com/gui/domain/${ioc}`
          : `https://www.virustotal.com/gui/file/${ioc}`,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
