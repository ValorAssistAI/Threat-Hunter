resource "aws_securityhub_account" "main" {}

resource "aws_securityhub_standards_subscription" "aws_foundational" {
  depends_on    = [aws_securityhub_account.main]
  standards_arn = "arn:aws:securityhub:${var.aws_region}::standards/aws-foundational-security-best-practices/v/1.0.0"
}

resource "aws_securityhub_standards_subscription" "cis" {
  depends_on    = [aws_securityhub_account.main]
  standards_arn = "arn:aws:securityhub:${var.aws_region}::standards/cis-aws-foundations-benchmark/v/1.2.0"
}

resource "aws_securityhub_product_subscription" "guardduty" {
  depends_on  = [aws_securityhub_account.main]
  product_arn = "arn:aws:securityhub:${var.aws_region}::product/aws/guardduty"
}

resource "aws_securityhub_product_subscription" "inspector" {
  depends_on  = [aws_securityhub_account.main]
  product_arn = "arn:aws:securityhub:${var.aws_region}::product/aws/inspector"
}

resource "aws_cloudwatch_event_rule" "securityhub_findings" {
  name        = "arnievulnai-securityhub-findings"
  description = "Capture Security Hub findings for audit log"

  event_pattern = jsonencode({
    source      = ["aws.securityhub"]
    detail-type = ["Security Hub Findings - Imported"]
    detail = {
      findings = {
        Severity = {
          Label = ["CRITICAL", "HIGH"]
        }
        Workflow = {
          Status = ["NEW"]
        }
      }
    }
  })
}

resource "aws_cloudwatch_event_target" "securityhub_logs" {
  rule      = aws_cloudwatch_event_rule.securityhub_findings.name
  target_id = "securityhub-to-cloudwatch"
  arn       = aws_cloudwatch_log_group.audit.arn
}
