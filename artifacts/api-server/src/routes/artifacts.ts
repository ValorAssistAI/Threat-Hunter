import { Router, type IRouter } from "express";
import {
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET, FOLDERS } from "../lib/aws";
import {
  ListArtifactFoldersResponse,
  ListArtifactsByFolderResponse,
  ListArtifactsByFolderParams,
  GetArtifactDownloadUrlParams,
  GetArtifactDownloadUrlResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/artifacts", async (req, res): Promise<void> => {
  try {
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
          const latest =
            objects.length > 0
              ? objects.sort(
                  (a, b) =>
                    (b.LastModified?.getTime() ?? 0) -
                    (a.LastModified?.getTime() ?? 0)
                )[0].LastModified?.toISOString() ?? null
              : null;

          return { name: folder, count: objects.length, lastModified: latest };
        } catch {
          return { name: folder, count: 0, lastModified: null };
        }
      })
    );

    res.json(ListArtifactFoldersResponse.parse(folderData));
  } catch (err) {
    req.log.error({ err }, "Failed to list S3 artifacts");
    res.status(500).json({ error: "Failed to list S3 artifacts" });
  }
});

router.get("/artifacts/:folder", async (req, res): Promise<void> => {
  const params = ListArtifactsByFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { folder } = params.data;

  try {
    const res2 = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: `${folder}/`,
        MaxKeys: 1000,
      })
    );

    const objects = (res2.Contents ?? [])
      .filter((o) => o.Key && o.Key !== `${folder}/`)
      .map((o) => ({
        key: o.Key?.replace(`${folder}/`, "") ?? "",
        folder,
        size: o.Size ?? 0,
        lastModified: o.LastModified?.toISOString() ?? new Date().toISOString(),
        etag: o.ETag ?? null,
      }));

    res.json(ListArtifactsByFolderResponse.parse(objects));
  } catch (err) {
    req.log.error({ err }, "Failed to list S3 folder");
    res.status(500).json({ error: "Failed to list S3 folder" });
  }
});

router.get("/artifacts/:folder/:key/url", async (req, res): Promise<void> => {
  const rawFolder = Array.isArray(req.params.folder)
    ? req.params.folder[0]
    : req.params.folder;
  const rawKey = Array.isArray(req.params.key)
    ? req.params.key[0]
    : req.params.key;

  const params = GetArtifactDownloadUrlParams.safeParse({
    folder: rawFolder,
    key: rawKey,
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: `${params.data.folder}/${params.data.key}`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.json(GetArtifactDownloadUrlResponse.parse({ url, expiresIn: 3600 }));
  } catch (err) {
    req.log.error({ err }, "Failed to generate presigned URL");
    res.status(500).json({ error: "Failed to generate presigned URL" });
  }
});

export default router;
