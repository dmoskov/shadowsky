#!/bin/bash

# Script to verify KMS encryption for CloudWatch logs
# Run after deploying the infrastructure changes

set -e

echo "==============================================="
echo "CloudWatch Logs KMS Encryption Verification"
echo "==============================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Lambda functions to check
FUNCTIONS=(
  "generate-alt-text"
  "adjust-tone"
  "writing-feedback"
  "optimize-thread"
  "suggest-hashtags"
  "style-analysis"
)

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI is not installed${NC}"
    exit 1
fi

echo "1. Checking KMS key..."
echo "---"

# Check if KMS key exists
KMS_KEY_ID=$(aws kms describe-key \
  --key-id alias/shadowsky/cloudwatch-logs \
  --query 'KeyMetadata.KeyId' \
  --output text 2>/dev/null || echo "")

if [ -z "$KMS_KEY_ID" ]; then
    echo -e "${RED}✗ KMS key 'shadowsky/cloudwatch-logs' not found${NC}"
    echo "Please deploy the infrastructure first"
    exit 1
else
    echo -e "${GREEN}✓ KMS key found: $KMS_KEY_ID${NC}"

    # Check key rotation
    KEY_ROTATION=$(aws kms get-key-rotation-status \
      --key-id alias/shadowsky/cloudwatch-logs \
      --query 'KeyRotationEnabled' \
      --output text)

    if [ "$KEY_ROTATION" == "True" ]; then
        echo -e "${GREEN}✓ Key rotation is enabled${NC}"
    else
        echo -e "${YELLOW}⚠ Key rotation is not enabled${NC}"
    fi
fi

echo ""
echo "2. Checking log groups encryption..."
echo "---"

ENCRYPTED_COUNT=0
TOTAL_COUNT=0

for FUNCTION in "${FUNCTIONS[@]}"; do
    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    # Get the actual function name from AWS (may have stack prefix)
    ACTUAL_FUNCTION_NAME=$(aws lambda list-functions \
      --query "Functions[?contains(FunctionName, '$FUNCTION')].FunctionName | [0]" \
      --output text 2>/dev/null || echo "")

    if [ -z "$ACTUAL_FUNCTION_NAME" ] || [ "$ACTUAL_FUNCTION_NAME" == "None" ]; then
        echo -e "${YELLOW}⚠ Lambda function not found: $FUNCTION${NC}"
        continue
    fi

    LOG_GROUP_NAME="/aws/lambda/$ACTUAL_FUNCTION_NAME"

    # Check if log group exists and is encrypted
    KMS_KEY=$(aws logs describe-log-groups \
      --log-group-name-prefix "$LOG_GROUP_NAME" \
      --query 'logGroups[0].kmsKeyId' \
      --output text 2>/dev/null || echo "")

    if [ -z "$KMS_KEY" ] || [ "$KMS_KEY" == "None" ]; then
        echo -e "${RED}✗ $FUNCTION: Not encrypted${NC}"
    else
        echo -e "${GREEN}✓ $FUNCTION: Encrypted with KMS${NC}"
        ENCRYPTED_COUNT=$((ENCRYPTED_COUNT + 1))

        # Check retention
        RETENTION=$(aws logs describe-log-groups \
          --log-group-name-prefix "$LOG_GROUP_NAME" \
          --query 'logGroups[0].retentionInDays' \
          --output text 2>/dev/null || echo "")

        if [ "$RETENTION" == "30" ]; then
            echo "  └─ Retention: 30 days ✓"
        else
            echo -e "  └─ ${YELLOW}Retention: $RETENTION days (expected 30)${NC}"
        fi
    fi
done

echo ""
echo "3. Summary"
echo "---"
echo "Total functions checked: $TOTAL_COUNT"
echo "Encrypted: $ENCRYPTED_COUNT"

if [ "$ENCRYPTED_COUNT" -eq "$TOTAL_COUNT" ]; then
    echo -e "${GREEN}✓ All log groups are encrypted with KMS${NC}"
    echo ""
    echo "4. Testing log access"
    echo "---"
    echo "To verify encryption is working, try reading logs:"
    echo ""
    echo "  aws logs get-log-events \\"
    echo "    --log-group-name /aws/lambda/<function-name> \\"
    echo "    --log-stream-name <stream-name> \\"
    echo "    --limit 10"
    echo ""
    echo "This should:"
    echo "  - Succeed if you have KMS decrypt permissions"
    echo "  - Fail with AccessDeniedException if missing KMS permissions"
    exit 0
else
    echo -e "${YELLOW}⚠ Some log groups are not encrypted${NC}"
    echo ""
    echo "Possible reasons:"
    echo "  1. Infrastructure not deployed yet (run: npx ampx sandbox or npx ampx deploy)"
    echo "  2. Log groups created before encryption was configured"
    echo "  3. CloudFormation stack update in progress"
    echo ""
    echo "To fix:"
    echo "  1. Deploy the latest infrastructure"
    echo "  2. Delete old unencrypted log groups (they will be recreated with encryption)"
    echo "  3. Invoke each Lambda function to create new encrypted log groups"
    exit 1
fi
