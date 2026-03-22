resource "aws_guardduty_detector" "main" {
  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = false
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  finding_publishing_frequency = "SIX_HOURS"
}

resource "aws_guardduty_filter" "high_severity" {
  name        = "high-and-critical-findings"
  detector_id = aws_guardduty_detector.main.id
  action      = "NOOP"
  rank        = 1

  finding_criteria {
    criterion {
      field  = "severity"
      gte_eq = ["7"]
    }
  }
}

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  name        = "arnievulnai-guardduty-findings"
  description = "Capture GuardDuty high/critical findings"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 7] }]
    }
  })
}

resource "aws_cloudwatch_event_target" "guardduty_logs" {
  rule      = aws_cloudwatch_event_rule.guardduty_findings.name
  target_id = "guardduty-to-cloudwatch"
  arn       = aws_cloudwatch_log_group.threat_intel.arn
}
