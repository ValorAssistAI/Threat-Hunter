import { Router, type IRouter } from "express";
import {
  ListDetectorsCommand,
  ListFindingsCommand,
  GetFindingsCommand,
  type Finding,
} from "@aws-sdk/client-guardduty";
import { guarddutyClient } from "../lib/aws";
import {
  ListGuardDutyFindingsQueryParams,
  ListGuardDutyFindingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function severityLabel(score: number): string {
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  if (score >= 1) return "LOW";
  return "INFORMATIONAL";
}

async function getDetectorId(): Promise<string | null> {
  const res = await guarddutyClient.send(new ListDetectorsCommand({}));
  return res.DetectorIds?.[0] ?? null;
}

function mapFinding(f: Finding) {
  return {
    id: f.Id ?? "",
    title: f.Title ?? "Unknown",
    description: f.Description ?? "",
    severity: f.Severity ?? 0,
    severityLabel: severityLabel(f.Severity ?? 0),
    type: f.Type ?? "Unknown",
    region: f.Region ?? "us-east-1",
    accountId: f.AccountId ?? "",
    resourceType: f.Resource?.ResourceType ?? null,
    createdAt: f.CreatedAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: f.UpdatedAt?.toISOString() ?? new Date().toISOString(),
    count: f.Service?.Count ?? 1,
  };
}

router.get("/security/guardduty/findings", async (req, res): Promise<void> => {
  const query = ListGuardDutyFindingsQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 50;

  try {
    const detectorId = await getDetectorId();
    if (!detectorId) {
      res.json(ListGuardDutyFindingsResponse.parse([]));
      return;
    }

    const listRes = await guarddutyClient.send(
      new ListFindingsCommand({
        DetectorId: detectorId,
        MaxResults: Math.min(limit, 50),
      })
    );

    const findingIds = listRes.FindingIds ?? [];
    if (findingIds.length === 0) {
      res.json(ListGuardDutyFindingsResponse.parse([]));
      return;
    }

    const getRes = await guarddutyClient.send(
      new GetFindingsCommand({
        DetectorId: detectorId,
        FindingIds: findingIds,
      })
    );

    const findings = (getRes.Findings ?? []).map(mapFinding);
    res.json(ListGuardDutyFindingsResponse.parse(findings));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GuardDuty findings");
    res.status(500).json({ error: "Failed to fetch GuardDuty findings" });
  }
});

export { getDetectorId };
export default router;
