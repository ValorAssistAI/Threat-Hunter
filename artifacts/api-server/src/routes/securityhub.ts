import { Router, type IRouter } from "express";
import { GetFindingsCommand, type AwsSecurityFinding } from "@aws-sdk/client-securityhub";
import { securityhubClient } from "../lib/aws";
import {
  ListSecurityHubFindingsQueryParams,
  ListSecurityHubFindingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapFinding(f: AwsSecurityFinding) {
  const resource = f.Resources?.[0];
  return {
    id: f.Id ?? "",
    title: f.Title ?? "Unknown",
    description: f.Description ?? "",
    severity: f.Severity?.Label ?? "INFORMATIONAL",
    severityScore: f.Severity?.Normalized ?? 0,
    status: f.Workflow?.Status ?? "NEW",
    productName: f.ProductName ?? null,
    resourceType: resource?.Type ?? null,
    resourceId: resource?.Id ?? null,
    createdAt: f.CreatedAt ?? new Date().toISOString(),
    updatedAt: f.UpdatedAt ?? new Date().toISOString(),
  };
}

router.get("/security/securityhub/findings", async (req, res): Promise<void> => {
  const query = ListSecurityHubFindingsQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 50;

  try {
    const res2 = await securityhubClient.send(
      new GetFindingsCommand({
        MaxResults: Math.min(limit, 100),
      })
    );

    const findings = (res2.Findings ?? []).map(mapFinding);
    res.json(ListSecurityHubFindingsResponse.parse(findings));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Security Hub findings");
    res.status(500).json({ error: "Failed to fetch Security Hub findings" });
  }
});

export default router;
