import { Router, type IRouter } from "express";
import { ListFindingsCommand, type Finding } from "@aws-sdk/client-inspector2";
import { inspectorClient } from "../lib/aws";
import {
  ListInspectorFindingsQueryParams,
  ListInspectorFindingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapFinding(f: Finding) {
  const cveId =
    f.packageVulnerabilityDetails?.vulnerabilityId ?? null;
  const cvssScore =
    f.inspectorScore ?? null;

  const resource = f.resources?.[0];

  return {
    arn: f.findingArn ?? "",
    title: f.title ?? "Unknown",
    description: f.description ?? "",
    severity: f.severity ?? "INFORMATIONAL",
    status: f.status ?? "ACTIVE",
    type: f.type ?? "UNKNOWN",
    resourceType: resource?.type ?? null,
    resourceId: resource?.id ?? null,
    cveId,
    cvssScore,
    createdAt: f.firstObservedAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: f.lastObservedAt?.toISOString() ?? new Date().toISOString(),
  };
}

router.get("/security/inspector/findings", async (req, res): Promise<void> => {
  const query = ListInspectorFindingsQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 50;

  try {
    const res2 = await inspectorClient.send(
      new ListFindingsCommand({
        maxResults: Math.min(limit, 100),
      })
    );

    const findings = (res2.findings ?? []).map(mapFinding);
    res.json(ListInspectorFindingsResponse.parse(findings));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Inspector findings");
    res.status(500).json({ error: "Failed to fetch Inspector findings" });
  }
});

export default router;
