resource "aws_s3_bucket" "artifacts" {
  bucket = "arnievulnai-artifacts"
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-samples"
    status = "Enabled"
    filter { prefix = "samples/" }
    expiration { days = 90 }
  }

  rule {
    id     = "expire-scan-results"
    status = "Enabled"
    filter { prefix = "scan-results/" }
    expiration { days = 180 }
  }

  rule {
    id     = "transition-reports"
    status = "Enabled"
    filter { prefix = "reports/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

# Folder "objects" (S3 has no real folders, but we create placeholder objects)
resource "aws_s3_object" "folder_reports" {
  bucket = aws_s3_bucket.artifacts.id
  key    = "reports/"
}

resource "aws_s3_object" "folder_scan_results" {
  bucket = aws_s3_bucket.artifacts.id
  key    = "scan-results/"
}

resource "aws_s3_object" "folder_audit" {
  bucket = aws_s3_bucket.artifacts.id
  key    = "audit/"
}

resource "aws_s3_object" "folder_samples" {
  bucket = aws_s3_bucket.artifacts.id
  key    = "samples/"
}

resource "aws_s3_object" "folder_threat_intel" {
  bucket = aws_s3_bucket.artifacts.id
  key    = "threat-intel/"
}

# Frontend hosting bucket
resource "aws_s3_bucket" "frontend" {
  bucket = "arnievulnai-frontend-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket.json
}

data "aws_iam_policy_document" "frontend_bucket" {
  statement {
    sid     = "AllowCloudFrontOAC"
    actions = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}
