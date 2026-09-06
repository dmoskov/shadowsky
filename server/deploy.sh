#!/bin/bash
echo "Asphodel public deployment was retired on 2026-09-06. Reopening requires an explicit decision and removal of this guard." >&2
exit 1
# Deploy API server to AWS ECS
# Usage: ./deploy.sh

set -e

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="181691141781"
ECR_REPO="shadowsky-api-server"
ECS_CLUSTER="shadowsky-cluster"
ECS_SERVICE="shadowsky-api-server"
IMAGE_TAG="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== ShadowSky API Server Deployment ===${NC}"
echo ""

# Check if we're in the server directory
if [ ! -f "api-server.js" ]; then
    echo -e "${RED}Error: api-server.js not found. Please run this script from the server directory.${NC}"
    exit 1
fi

# Check for required tools
echo -e "${YELLOW}Checking prerequisites...${NC}"
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed.${NC}" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo -e "${RED}AWS CLI is required but not installed.${NC}" >&2; exit 1; }
echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Build the Docker image for linux/amd64 (ECS Fargate architecture)
echo -e "${YELLOW}Building Docker image for linux/amd64...${NC}"
docker build --platform linux/amd64 -t ${ECR_REPO}:${IMAGE_TAG} .
echo -e "${GREEN}✓ Docker image built${NC}"
echo ""

# Tag the image for ECR
echo -e "${YELLOW}Tagging image for ECR...${NC}"
docker tag ${ECR_REPO}:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}
echo -e "${GREEN}✓ Image tagged${NC}"
echo ""

# Login to ECR
echo -e "${YELLOW}Logging in to ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
echo -e "${GREEN}✓ Logged in to ECR${NC}"
echo ""

# Push to ECR
echo -e "${YELLOW}Pushing image to ECR...${NC}"
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}
echo -e "${GREEN}✓ Image pushed to ECR${NC}"
echo ""

# Force ECS service to pull new image
echo -e "${YELLOW}Updating ECS service (force new deployment)...${NC}"
aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --force-new-deployment \
    --region ${AWS_REGION} \
    --query 'service.deployments[0].status' \
    --output text
echo -e "${GREEN}✓ ECS deployment triggered${NC}"
echo ""

# Wait for deployment to stabilize (optional, with timeout)
echo -e "${YELLOW}Waiting for deployment to stabilize (this may take 2-3 minutes)...${NC}"
aws ecs wait services-stable \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION} && \
echo -e "${GREEN}✓ Deployment complete and stable${NC}" || \
echo -e "${YELLOW}⚠ Deployment in progress (check AWS console for status)${NC}"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Test the API with:"
echo "  curl https://api.shadowsky.io/health"
echo "  curl -X POST https://api.shadowsky.io/api/thread-summary -H 'Content-Type: application/json' -d '{\"posts\":[...]}'"
