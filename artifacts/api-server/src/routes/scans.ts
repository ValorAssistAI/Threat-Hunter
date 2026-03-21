import { Router, type IRouter } from "express";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "../lib/aws";
import { ListScanResultsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/scans", async (req, res): Promise<void> => {
  try {
    const res2 = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: "scan-results/",
        MaxKeys: 500,
      })
    );

    const objects = (res2.Contents ?? [])
      .filter((o) => o.Key && o.Key !== "scan-results/")
      .map((o) => ({
        key: o.Key?.replace("scan-results/", "") ?? "",
        folder: "scan-results",
        size: o.Size ?? 0,
        lastModified: o.LastModified?.toISOString() ?? new Date().toISOString(),
        etag: o.ETag ?? null,
      }));

    res.json(ListScanResultsResponse.parse(objects));
  } catch (err) {
    req.log.error({ err }, "Failed to list scan results");
    res.status(500).json({ error: "Failed to list scan results" });
  }
});

export default router;
