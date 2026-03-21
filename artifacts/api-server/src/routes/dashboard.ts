import { Router, type IRouter } from "express";
import {
  ListDetectorsCommand,
  ListFindingsCommand,
  GetFindingsCommand,
} from "@aws-sdk/client-guardduty";
import { ListFindingsCommand as InspectorListFindings } from "@aws-sdk/client-inspector2";
import { GetFindingsCommand as SHGetFindings } from "@aws-sdk/client-securityhub";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
  guarddutyClient,
  inspectorClient,
  securityhubClient,
  s3Client,
  S3_BUCKET,
  FOLDERS,
} from "../lib/aws";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  try {
    const [gdResult, inspResult, shResult, s3Result] = await Promise.allSettled([
      (async () => {
        const detRes = await guarddutyClient.send(new ListDetectorsCommand({}));
        const detectorId = detRes.DetectorIds?.[0];
        if (!detectorId) return { status: "no-detector", total: 0, critical: 0, high: 0, medium: 0, low: 0 };

        const listRes = await guarddutyClient.send(
          new ListFindingsCommand({ DetectorId: detectorId, MaxResults: 50 })
        );
        const ids = listRes.FindingIds ?? [];

        if (ids.length === 0) return { status: "active", total: 0, critical: 0, high: 0, medium: 0, low: 0 };

        const getRes = await guarddutyClient.send(
          new GetFindingsCommand({ DetectorId: detectorId, FindingIds: ids })
        );

        const findings = getRes.Findings ?? [];
        let critical = 0, high = 0, medium = 0, low = 0;
        for (const f of findings) {
          const s = f.Severity ?? 0;
          if (s >= 9) critical++;
          else if (s >= 7) high++;
          else if (s >= 4) medium++;
          else low++;
        }
        return { status: "active", total: findings.length, critical, high, medium, low };
      })(),
      (async () => {
        const res2 = await inspectorClient.send(
          new InspectorListFindings({ maxResults: 100 })
        );
        const findings = res2.findings ?? [];
        let critical = 0, high = 0, medium = 0, low = 0;
        for (const f of findings) {
          const s = f.severity ?? "";
          if (s === "CRITICAL") critical++;
          else if (s === "HIGH") high++;
          else if (s === "MEDIUM") medium++;
          else low++;
        }
        return { status: "active", total: findings.length, critical, high, medium, low };
      })(),
      (async () => {
        const res2 = await securityhubClient.send(new SHGetFindings({ MaxResults: 100 }));
        const findings = res2.Findings ?? [];
        let critical = 0, high = 0, medium = 0, low = 0;
        for (const f of findings) {
          const s = f.Severity?.Label ?? "";
          if (s === "CRITICAL") critical++;
          else if (s === "HIGH") high++;
          else if (s === "MEDIUM") medium++;
          else low++;
        }
        return { status: "active", total: findings.length, critical, high, medium, low };
      })(),
      (async () => {
        const folderData = await Promise.all(
          FOLDERS.map(async (folder) => {
            try {
              const res2 = await s3Client.send(
                new ListObjectsV2Command({
                  Bucket: S3_BUCKET,
                  Prefix: `${folder}/`,
                  MaxKeys: 1000,
                })
              );
              const objects = (res2.Contents ?? []).filter(
                (o) => o.Key && o.Key !== `${folder}/`
              );
              const latest = objects.length > 0
                ? objects.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))[0].LastModified?.toISOString() ?? null
                : null;
              return { name: folder, count: objects.length, lastModified: latest };
            } catch {
              return { name: folder, count: 0, lastModified: null };
            }
          })
        );
        return { bucket: S3_BUCKET, folders: folderData };
      })(),
    ]);

    const defaultSvc = { status: "error", total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    const defaultS3 = { bucket: S3_BUCKET, folders: FOLDERS.map((name) => ({ name, count: 0, lastModified: null })) };

    const guardduty = gdResult.status === "fulfilled" ? gdResult.value : defaultSvc;
    const inspector = inspResult.status === "fulfilled" ? inspResult.value : defaultSvc;
    const securityhub = shResult.status === "fulfilled" ? shResult.value : defaultSvc;
    const s3 = s3Result.status === "fulfilled" ? s3Result.value : defaultS3;

    const recentActivity: Array<{ id: string; source: string; title: string; severity: string; timestamp: string }> = [];

    const summary = {
      guardduty,
      inspector,
      securityhub,
      s3,
      recentActivity,
    };

    res.json(GetDashboardSummaryResponse.parse(summary));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch dashboard summary");
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

export default router;
