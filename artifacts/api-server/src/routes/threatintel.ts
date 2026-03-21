import { Router, type IRouter } from "express";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { s3Client, secretsClient, S3_BUCKET } from "../lib/aws";
import {
  ListThreatIntelItemsResponse,
  VirusTotalLookupQueryParams,
  VirusTotalLookupResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

let cachedVTKey: string | null = null;

async function getVTApiKey(): Promise<string | null> {
  if (cachedVTKey) return cachedVTKey;

  const envKey = process.env.VIRUSTOTAL_API_KEY;
  if (envKey) {
    cachedVTKey = envKey;
    return cachedVTKey;
  }

  try {
    const res = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: "arnievulnai/virustotal-api-key",
      })
    );
    cachedVTKey = res.SecretString ?? null;
    return cachedVTKey;
  } catch {
    return null;
  }
}

function detectIocType(ioc: string): string {
  if (/^[a-fA-F0-9]{32}$/.test(ioc)) return "md5";
  if (/^[a-fA-F0-9]{40}$/.test(ioc)) return "sha1";
  if (/^[a-fA-F0-9]{64}$/.test(ioc)) return "sha256";
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ioc)) return "ip";
  return "domain";
}

router.get("/threat-intel", async (req, res): Promise<void> => {
  try {
    const res2 = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: "threat-intel/",
        MaxKeys: 200,
      })
    );

    const objects = (res2.Contents ?? [])
      .filter((o) => o.Key && o.Key !== "threat-intel/")
      .map((o) => ({
        key: o.Key?.replace("threat-intel/", "") ?? "",
        folder: "threat-intel",
        size: o.Size ?? 0,
        lastModified: o.LastModified?.toISOString() ?? new Date().toISOString(),
        etag: o.ETag ?? null,
      }));

    res.json(ListThreatIntelItemsResponse.parse(objects));
  } catch (err) {
    req.log.error({ err }, "Failed to list threat intel items");
    res.status(500).json({ error: "Failed to list threat intel items" });
  }
});

router.get("/threat-intel/lookup", async (req, res): Promise<void> => {
  const query = VirusTotalLookupQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { ioc } = query.data;
  if (!ioc || ioc.trim().length === 0) {
    res.status(400).json({ error: "IOC is required" });
    return;
  }

  const iocType = detectIocType(ioc.trim());

  try {
    const apiKey = await getVTApiKey();
    if (!apiKey) {
      res.status(503).json({ error: "VirusTotal API key not configured" });
      return;
    }

    let vtEndpoint: string;
    if (iocType === "md5" || iocType === "sha1" || iocType === "sha256") {
      vtEndpoint = `https://www.virustotal.com/api/v3/files/${ioc}`;
    } else if (iocType === "ip") {
      vtEndpoint = `https://www.virustotal.com/api/v3/ip_addresses/${ioc}`;
    } else {
      vtEndpoint = `https://www.virustotal.com/api/v3/domains/${ioc}`;
    }

    const vtRes = await fetch(vtEndpoint, {
      headers: { "x-apikey": apiKey },
    });

    if (!vtRes.ok) {
      req.log.warn({ status: vtRes.status, ioc }, "VirusTotal API error");
      res.status(vtRes.status).json({ error: "VirusTotal lookup failed" });
      return;
    }

    const vtData = (await vtRes.json()) as {
      data?: {
        attributes?: {
          last_analysis_stats?: {
            malicious?: number;
            suspicious?: number;
            undetected?: number;
            harmless?: number;
          };
          reputation?: number;
          last_analysis_date?: number;
          tags?: string[];
        };
      };
    };

    const attrs = vtData?.data?.attributes ?? {};
    const stats = attrs.last_analysis_stats ?? {};
    const malicious = stats.malicious ?? 0;
    const suspicious = stats.suspicious ?? 0;
    const undetected = stats.undetected ?? 0;
    const harmless = stats.harmless ?? 0;
    const total = malicious + suspicious + undetected + harmless;

    const lastDate = attrs.last_analysis_date
      ? new Date(attrs.last_analysis_date * 1000).toISOString()
      : null;

    let permalink: string | null = null;
    if (iocType === "md5" || iocType === "sha1" || iocType === "sha256") {
      permalink = `https://www.virustotal.com/gui/file/${ioc}`;
    } else if (iocType === "ip") {
      permalink = `https://www.virustotal.com/gui/ip-address/${ioc}`;
    } else {
      permalink = `https://www.virustotal.com/gui/domain/${ioc}`;
    }

    const result = {
      ioc,
      iocType,
      malicious,
      suspicious,
      undetected,
      harmless,
      total,
      reputation: attrs.reputation ?? null,
      lastAnalysisDate: lastDate,
      tags: attrs.tags ?? [],
      permalink,
    };

    res.json(VirusTotalLookupResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "VirusTotal lookup error");
    res.status(500).json({ error: "VirusTotal lookup failed" });
  }
});

export default router;
