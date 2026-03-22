#!/usr/bin/env bash
# bootstrap-terraform-state.sh
# Run once to create the S3 bucket and DynamoDB table for Terraform remote state.
# Requires AWS CLI with admin permissions.

set -euo pipefail

BUCKET="arnievulnai-terraform-state"
TABLE="arnievulnai-terraform-locks"
REGION="${AWS_REGION:-us-east-1}"

echo "==> Bootstrapping Terraform remote state in region: $REGION"

# Create S3 bucket
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "  [skip] S3 bucket '$BUCKET' already exists"
else
  echo "  [create] S3 bucket: $BUCKET"
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
fi

# Enable versioning
echo "  [configure] S3 versioning"
aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

# Enable encryption
echo "  [configure] S3 encryption"
aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
echo "  [configure] S3 block public access"
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Create DynamoDB lock table
if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" 2>/dev/null; then
  echo "  [skip] DynamoDB table '$TABLE' already exists"
else
  echo "  [create] DynamoDB table: $TABLE"
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
fi

echo ""
echo "==> Done. Terraform state backend ready."
echo "    Bucket:          s3://$BUCKET"
echo "    DynamoDB table:  $TABLE"
echo "    Region:          $REGION"
echo ""
echo "Now run: cd infra && terraform init"
