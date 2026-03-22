variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID (used for resource policies)"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Must be production, staging, or development."
  }
}

variable "db_url" {
  description = "PostgreSQL connection string for the API server"
  type        = string
  sensitive   = true
}

variable "virustotal_api_key" {
  description = "VirusTotal API key stored in Secrets Manager"
  type        = string
  sensitive   = true
  default     = ""
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "api_image_tag" {
  description = "ECR image tag to deploy"
  type        = string
  default     = "latest"
}

variable "api_task_cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 512
}

variable "api_task_memory" {
  description = "ECS task memory (MiB)"
  type        = number
  default     = 1024
}

variable "ai_anthropic_base_url" {
  description = "Anthropic AI proxy base URL"
  type        = string
  default     = ""
}

variable "ai_anthropic_api_key" {
  description = "Anthropic AI proxy API key"
  type        = string
  sensitive   = true
  default     = ""
}
