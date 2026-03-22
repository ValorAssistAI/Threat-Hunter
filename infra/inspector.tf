resource "aws_inspector2_enabler" "main" {
  account_ids    = [var.aws_account_id]
  resource_types = ["EC2", "ECR", "LAMBDA"]
}

resource "aws_cloudwatch_event_rule" "inspector_findings" {
  name        = "arnievulnai-inspector-findings"
  description = "Capture Inspector v2 critical findings"

  event_pattern = jsonencode({
    source      = ["aws.inspector2"]
    detail-type = ["Inspector2 Finding"]
    detail = {
      severity = ["CRITICAL", "HIGH"]
    }
  })
}

resource "aws_cloudwatch_event_target" "inspector_logs" {
  rule      = aws_cloudwatch_event_rule.inspector_findings.name
  target_id = "inspector-to-cloudwatch"
  arn       = aws_cloudwatch_log_group.scan_results.arn
}
