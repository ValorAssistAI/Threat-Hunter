import { Router, type IRouter } from "express";
import {
  DescribeLogGroupsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { cloudwatchClient } from "../lib/aws";
import {
  ListLogGroupsResponse,
  GetLogEventsQueryParams,
  GetLogEventsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ARNIEVULNAI_LOG_GROUPS = [
  "/arnievulnai/audit",
  "/arnievulnai/scan-results",
  "/arnievulnai/threat-intel",
  "/arnievulnai/tool-invocations",
];

router.get("/logs/groups", async (req, res): Promise<void> => {
  try {
    const res2 = await cloudwatchClient.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: "/arnievulnai",
      })
    );

    const groups = (res2.logGroups ?? []).map((g) => ({
      name: g.logGroupName ?? "",
      retentionDays: g.retentionInDays ?? null,
      storedBytes: g.storedBytes ? Number(g.storedBytes) : null,
    }));

    if (groups.length === 0) {
      const fallback = ARNIEVULNAI_LOG_GROUPS.map((name) => ({
        name,
        retentionDays: null,
        storedBytes: null,
      }));
      res.json(ListLogGroupsResponse.parse(fallback));
      return;
    }

    res.json(ListLogGroupsResponse.parse(groups));
  } catch (err) {
    req.log.error({ err }, "Failed to list log groups");
    res.status(500).json({ error: "Failed to list log groups" });
  }
});

router.get("/logs/events", async (req, res): Promise<void> => {
  const query = GetLogEventsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { group, limit, startTime } = query.data;

  try {
    const res2 = await cloudwatchClient.send(
      new GetLogEventsCommand({
        logGroupName: group,
        limit: Math.min(limit ?? 100, 100),
        startTime: startTime ? Number(startTime) : undefined,
        startFromHead: false,
      })
    );

    const events = (res2.events ?? []).map((e) => ({
      timestamp: e.timestamp ?? Date.now(),
      message: e.message ?? "",
      ingestionTime: e.ingestionTime ? Number(e.ingestionTime) : null,
    }));

    res.json(GetLogEventsResponse.parse(events));
  } catch (err) {
    req.log.error({ err }, "Failed to get log events");
    res.status(500).json({ error: "Failed to get log events" });
  }
});

export default router;
