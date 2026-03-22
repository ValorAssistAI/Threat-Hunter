#!/usr/bin/env bash
# verify-aws.sh
# Verify that all required AWS services are accessible with the configured credentials.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

pass() { echo "  [PASS] $1"; }
fail() { echo "  [FAIL] $1"; FAILED=$((FAILED + 1)); }

FAILED=0

echo "==> Verifying AWS connectivity (region: $REGION)"
echo ""

# Caller identity
echo "[Identity]"
IDENTITY=$(aws sts get-caller-identity --region "$REGION" 2>&1)
if [ $? -eq 0 ]; then
  ACCOUNT=$(echo "$IDENTITY" | python3 -c "import sys,json; print(json.load(sys.stdin)['Account'])")
  ARN=$(echo "$IDENTITY" | python3 -c "import sys,json; print(json.load(sys.stdin)['Arn'])")
  pass "Authenticated as: $ARN (account: $ACCOUNT)"
else
  fail "Cannot authenticate: $IDENTITY"
  exit 1
fi

echo ""
echo "[GuardDuty]"
DETECTORS=$(aws guardduty list-detectors --region "$REGION" 2>&1)
if [ $? -eq 0 ]; then
  COUNT=$(echo "$DETECTORS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['DetectorIds']))")
  if [ "$COUNT" -gt 0 ]; then
    pass "GuardDuty active ($COUNT detector(s))"
  else
    fail "GuardDuty: no detectors found — enable GuardDuty in this region"
  fi
else
  fail "GuardDuty: $DETECTORS"
fi

echo ""
echo "[Inspector v2]"
INSPECTOR=$(aws inspector2 list-findings --region "$REGION" --max-results 1 2>&1)
if [ $? -eq 0 ]; then
  pass "Inspector v2 accessible"
else
  fail "Inspector v2: $INSPECTOR"
fi

echo ""
echo "[Security Hub]"
SECURITYHUB=$(aws securityhub describe-hub --region "$REGION" 2>&1)
if [ $? -eq 0 ]; then
  pass "Security Hub active"
else
  fail "Security Hub: $SECURITYHUB"
fi

echo ""
echo "[S3 — arnievulnai-artifacts]"
S3=$(aws s3 ls s3://arnievulnai-artifacts 2>&1)
if [ $? -eq 0 ]; then
  pass "S3 bucket accessible"
else
  fail "S3: $S3"
fi

echo ""
echo "[CloudWatch Logs]"
CW=$(aws logs describe-log-groups --log-group-name-prefix /arnievulnai --region "$REGION" 2>&1)
if [ $? -eq 0 ]; then
  COUNT=$(echo "$CW" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('logGroups', [])))")
  pass "CloudWatch: $COUNT /arnievulnai/* log groups found"
else
  fail "CloudWatch: $CW"
fi

echo ""
echo "[Secrets Manager — VirusTotal]"
VT=$(aws secretsmanager describe-secret --secret-id arnievulnai/virustotal-api-key --region "$REGION" 2>&1)
if [ $? -eq 0 ]; then
  pass "VirusTotal secret exists in Secrets Manager"
else
  fail "Secrets Manager: arnievulnai/virustotal-api-key not found — store it first"
fi

echo ""
echo "==> Verification complete. Failures: $FAILED"
[ $FAILED -eq 0 ] || exit 1
