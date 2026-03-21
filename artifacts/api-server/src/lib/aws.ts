import { GuardDutyClient } from "@aws-sdk/client-guardduty";
import { Inspector2Client } from "@aws-sdk/client-inspector2";
import { SecurityHubClient } from "@aws-sdk/client-securityhub";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const region = process.env.AWS_REGION ?? "us-east-1";

const clientConfig = { region };

export const guarddutyClient = new GuardDutyClient(clientConfig);
export const inspectorClient = new Inspector2Client(clientConfig);
export const securityhubClient = new SecurityHubClient(clientConfig);
export const s3Client = new S3Client(clientConfig);
export const cloudwatchClient = new CloudWatchLogsClient(clientConfig);
export const secretsClient = new SecretsManagerClient(clientConfig);

export const S3_BUCKET = process.env.ARNIEVULNAI_S3_BUCKET ?? "arnievulnai-artifacts";

export const FOLDERS = ["reports", "scan-results", "audit", "samples", "threat-intel"] as const;
