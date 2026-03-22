resource "aws_secretsmanager_secret" "virustotal" {
  name                    = "arnievulnai/virustotal-api-key"
  description             = "VirusTotal API key for IOC enrichment"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "virustotal" {
  count         = var.virustotal_api_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.virustotal.id
  secret_string = var.virustotal_api_key
}

resource "aws_secretsmanager_secret" "db_url" {
  name                    = "arnievulnai/database-url"
  description             = "PostgreSQL connection string for ArnieVulnAI API"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id     = aws_secretsmanager_secret.db_url.id
  secret_string = var.db_url
}

resource "aws_secretsmanager_secret" "anthropic_key" {
  name                    = "arnievulnai/anthropic-api-key"
  description             = "Anthropic AI integration API key"
  recovery_window_in_days = 7
}
