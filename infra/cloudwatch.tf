resource "aws_cloudwatch_log_group" "audit" {
  name              = "/arnievulnai/audit"
  retention_in_days = 365
}

resource "aws_cloudwatch_log_group" "scan_results" {
  name              = "/arnievulnai/scan-results"
  retention_in_days = 180
}

resource "aws_cloudwatch_log_group" "threat_intel" {
  name              = "/arnievulnai/threat-intel"
  retention_in_days = 90
}

resource "aws_cloudwatch_log_group" "tool_invocations" {
  name              = "/arnievulnai/tool-invocations"
  retention_in_days = 90
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/arnievulnai/api"
  retention_in_days = 30
}

# CloudWatch dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "ArnieVulnAI-Security"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title  = "GuardDuty Findings"
          region = var.aws_region
          metrics = [
            ["AWS/GuardDuty", "FindingsCount", { stat = "Sum" }]
          ]
          period = 3600
        }
      },
      {
        type = "log"
        properties = {
          title   = "Recent Audit Log"
          region  = var.aws_region
          query   = "SOURCE '/arnievulnai/audit' | fields @timestamp, @message | sort @timestamp desc | limit 20"
          view    = "table"
        }
      },
      {
        type = "log"
        properties = {
          title   = "Agent Tool Invocations"
          region  = var.aws_region
          query   = "SOURCE '/arnievulnai/tool-invocations' | fields @timestamp, @message | sort @timestamp desc | limit 50"
          view    = "table"
        }
      }
    ]
  })
}

# CloudWatch alarms
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "arnievulnai-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "API 5xx error rate is too high"
  alarm_actions       = []

  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
  }
}
