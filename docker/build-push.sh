#!/bin/bash
# Build and push ShadowSky API server to ECR
# Always builds for linux/amd64 (Fargate runs x86_64)
set -e

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="181691141781"
ECR_REPO="shadowsky-api-server"
IMAGE_TAG="${1:-latest}"
SERVER_DIR="$(cd "$(dirname "$0")/../server" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== ShadowSky API Server Build & Push ===${NC}"
echo "Region:    ${AWS_REGION}"
echo "Repo:      ${ECR_REPO}"
echo "Tag:       ${IMAGE_TAG}"
echo "Source:    ${SERVER_DIR}"
echo ""

# Validate
if [ ! -f "${SERVER_DIR}/Dockerfile" ]; then
    echo -e "${RED}Error: ${SERVER_DIR}/Dockerfile not found${NC}"
    exit 1
fi

command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker required${NC}"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo -e "${RED}AWS CLI required${NC}"; exit 1; }

# Login to ECR
echo -e "${YELLOW}Authenticating with ECR...${NC}"
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo -e "${GREEN}OK${NC}"

# Build (always linux/amd64 for Fargate)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
echo -e "${YELLOW}Building for linux/amd64...${NC}"
docker build \
  --platform linux/amd64 \
  -t "${ECR_URI}:${IMAGE_TAG}" \
  -t "${ECR_URI}:$(git -C "${SERVER_DIR}" rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
  "${SERVER_DIR}"
echo -e "${GREEN}OK${NC}"

# Push
echo -e "${YELLOW}Pushing to ECR...${NC}"
docker push "${ECR_URI}" --all-tags
echo -e "${GREEN}OK${NC}"

# Deploy to ECS
echo -e "${YELLOW}Triggering ECS deployment...${NC}"
aws ecs update-service \
  --cluster shadowsky-cluster \
  --service shadowsky-api-server \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --query 'service.deployments[0].status' \
  --output text
echo -e "${GREEN}OK${NC}"

echo ""
echo -e "${YELLOW}Waiting for deployment to stabilize...${NC}"
aws ecs wait services-stable \
  --cluster shadowsky-cluster \
  --services shadowsky-api-server \
  --region "${AWS_REGION}" && \
echo -e "${GREEN}Deployment complete${NC}" || \
echo -e "${YELLOW}Deployment in progress (check AWS console)${NC}"

echo ""
echo -e "${GREEN}=== Done ===${NC}"
echo "Test: curl https://api.shadowsky.io/health"
