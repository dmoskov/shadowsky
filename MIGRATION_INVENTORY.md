# Migration Inventory: BSKY (ShadowSky)

**Target account:** `086046210181` (bsky member account)
**Source account:** `181691141781` (management account)
**Date:** 2026-08-29
**Purpose:** Enumerate every hardcoded management-account reference and AWS resource dependency before parameterizing for the member-account move.

---

## 1. Hardcoded Management-Account References (`181691141781`)

Every occurrence of the management account ID in the repo, grouped by file:

### `.github/workflows/deploy-server.yml`
| Line | Context | Type |
|------|---------|------|
| 20 | `AWS_ACCOUNT_ID: "181691141781"` | env var |
| 37 | `role-to-assume: arn:aws:iam::181691141781:role/github-actions-deploy-role` | IAM role ARN (OIDC) |

### `amplify.yml`
| Line | Context | Type |
|------|---------|------|
| 46 | `aws s3 sync dist/ s3://shadowsky-frontend-181691141781/ --delete` | S3 bucket name |

### `docker/build-push.sh`
| Line | Context | Type |
|------|---------|------|
| 8 | `AWS_ACCOUNT_ID="181691141781"` | shell var |

### `server/deploy.sh`
| Line | Context | Type |
|------|---------|------|
| 9 | `AWS_ACCOUNT_ID="181691141781"` | shell var |

### `infrastructure/ecs/shadowsky-task-def.json`
| Line | Context | Type |
|------|---------|------|
| 7 | `"executionRoleArn": "arn:aws:iam::181691141781:role/ecsTaskExecutionRole"` | IAM role ARN |
| 8 | `"taskRoleArn": "arn:aws:iam::181691141781:role/ecsTaskRole"` | IAM role ARN |
| 12 | `"image": "181691141781.dkr.ecr.us-east-1.amazonaws.com/shadowsky-api-server:latest"` | ECR image URL |

### `infrastructure/ecs/shadowsky-service.json`
| Line | Context | Type |
|------|---------|------|
| 16 | `"targetGroupArn": "arn:aws:elasticloadbalancing:us-west-1:181691141781:targetgroup/shadowsky-api-http/..."` | ALB target group ARN |
| 21 | `"targetGroupArn": "arn:aws:elasticloadbalancing:us-west-1:181691141781:targetgroup/shadowsky-api-ws/..."` | ALB target group ARN |

### `infra/site/main.tf`
| Line | Context | Type |
|------|---------|------|
| 51 | `# ARN: arn:aws:acm:us-east-1:181691141781:certificate/0a173bfe-...` | ACM cert ARN (comment) |

### `infrastructure/lambda-edge/cloudfront-stack.ts`
| Line | Context | Type |
|------|---------|------|
| 143 | `'arn:aws:lambda:us-east-1:181691141781:function:shadowsky-og-meta-edge:1'` | Lambda ARN (default) |

### `infrastructure/lambda-edge/cdk.out/ShadowSkyCloudFront.template.json`
| Line | Context | Type |
|------|---------|------|
| 64 | `"LambdaFunctionARN": "arn:aws:lambda:us-east-1:181691141781:function:shadowsky-og-meta-edge:2"` | Lambda ARN (synthesized) |

**Total:** 13 hardcoded occurrences across 9 files.

### Hardcoded Region Assumptions

The codebase uses **two regions** — this is intentional (Lambda@Edge requires us-east-1) but creates migration complexity:

| Region | Usage | Files |
|--------|-------|-------|
| `us-east-1` | ECS cluster, ECR, CloudWatch Logs, Lambda@Edge, CloudFront ACM certs, Secrets Manager, Terraform default | `deploy-server.yml:19`, `docker/build-push.sh:7`, `server/deploy.sh:8`, `infrastructure/ecs/shadowsky-task-def.json:12,69`, `infra/site/variables.tf:4`, `infrastructure/lambda-edge/cloudfront-stack.ts:36`, `infrastructure/lambda-edge/deploy-stack.ts:27` |
| `us-west-1` | Cognito User Pool, AppSync GraphQL, ALB target groups (stale JSON — TF now uses us-east-1) | `amplify_outputs.json:3-4,6,29-30,113`, `infrastructure/ecs/shadowsky-service.json:16,21` |

**Note:** The `us-west-1` references in `infrastructure/ecs/shadowsky-service.json` (target group ARNs) appear stale — the Terraform IaC in `infra/site/` provisions everything in `us-east-1`. These JSON files are legacy hand-managed configs predating the Terraform migration.

---

## 2. AWS Resources Referenced

### ECS (Elastic Container Service)
| Resource | Name/ID | Managed By |
|----------|---------|------------|
| Cluster | `shadowsky-cluster` | Terraform (`infra/site/ecs.tf`) + GH Actions (creates if missing) |
| Service | `shadowsky-api-server` | Terraform (`infra/site/ecs.tf`) |
| Task family | `shadowsky-api-server` | Terraform (`infra/site/ecs.tf`) |
| Log group | `/ecs/shadowsky-api-server` | Terraform (`infra/site/logs.tf`) |

### ECR (Container Registry)
| Resource | Name | Managed By |
|----------|------|------------|
| Repository | `shadowsky-api-server` | Terraform (`infra/site/ecr.tf`) |

### S3 Buckets
| Bucket | Purpose | Managed By |
|--------|---------|------------|
| `shadowsky-frontend-{account_id}` | Static web frontend (prod S3+CloudFront) | Terraform (`infra/site/s3-cloudfront.tf`) |
| `shadowsky-frontend-181691141781` | Same bucket, hardcoded in `amplify.yml:46` | Amplify build spec |
| `shadowsky-build-artifacts-{account_id}` | CodeBuild artifacts | Terraform (`infra/site/codebuild.tf`) |
| `cdk-hnb659fds-assets-{account_id}-us-east-1` | CDK bootstrap bucket | CDK (`infrastructure/lambda-edge/cdk.out/`) |

### Lambda
| Function | Region | Purpose | Managed By |
|----------|--------|---------|------------|
| `shadowsky-og-meta-edge` | us-east-1 | OG meta tag injection via Lambda@Edge | CDK (`infrastructure/lambda-edge/`) |
| Amplify scheduled-posts Lambda | (Amplify-managed) | Scheduled post processing | Amplify (`amplify/backend.ts`) |

### DynamoDB
| Table | Purpose | Managed By |
|-------|---------|------------|
| `shadowsky-push-tokens` | Push notification token storage | Terraform (`infra/site/push-tokens.tf`) |
| `shadowsky-trending-production` | Trending topics (env var in ECS task def) | Unknown (referenced but not in TF) |

### CloudFront Distributions
| Distribution | Domain(s) | Managed By |
|-------------|-----------|------------|
| (Terraform-managed) | `shadowsky.io`, `www.shadowsky.io` | Terraform (`infra/site/s3-cloudfront.tf`) |
| `E23PU8CFBQFK81` | (hardcoded in `amplify.yml:48` for cache invalidation) | Unknown/manual |
| Amplify-managed | `asphodel.is`, `www.asphodel.is`, `main.asphodel.is` | AWS Amplify (app `d1g6mni4b6812x`) |

### ALB (Application Load Balancer)
| Resource | Name | Managed By |
|----------|------|------------|
| ALB | `shadowsky-api-alb` | Terraform (`infra/site/alb.tf`) |
| Target group (HTTP) | `shadowsky-api-http` | Terraform (`infra/site/alb.tf`) |
| Target group (WS) | `shadowsky-api-ws` | Terraform (`infra/site/alb.tf`) |

### ACM Certificates
| Certificate | Domain(s) | Region |
|-------------|-----------|--------|
| `0a173bfe-3774-4a34-af22-5e0e76e1148b` | `shadowsky.io`, `*.shadowsky.io`, `asphodel.is`, `*.asphodel.is` | us-east-1 |
| (separate) | `asphodel.is` (SNI on ALB) | us-east-1 |

### Route53 Hosted Zones
| Zone ID | Domain | Managed By |
|---------|--------|------------|
| `Z1002571THA70GW1RBGB` | `shadowsky.io` | Terraform (`infra/site/main.tf`) |
| `Z0676411215OEF4OS4O0X` | `asphodel.is` | Terraform (`infra/site/main.tf`) |

### DNS Records
| Record | Type | Target | Managed By |
|--------|------|--------|------------|
| `api.shadowsky.io` | A (alias) | ALB | Terraform (`infra/site/dns.tf`) |
| `api.asphodel.is` | A (alias) | ALB | Terraform (`infra/site/dns.tf`) |
| `shadowsky.io` | A (alias) | CloudFront | Terraform (`infra/site/dns.tf`) |
| `www.shadowsky.io` | CNAME | CloudFront | Terraform (`infra/site/dns.tf`) |
| `asphodel.is` / `www.asphodel.is` / `main.asphodel.is` | — | Amplify | AWS Amplify (NOT in Terraform) |

### VPC / Networking
| Resource | CIDR / ID | Managed By |
|----------|-----------|------------|
| VPC | `10.3.0.0/16` | Terraform (`infra/site/networking.tf`) |
| Public subnets (2) | `10.3.0.0/24`, `10.3.1.0/24` | Terraform |
| Private subnets (2) | `10.3.10.0/24`, `10.3.11.0/24` | Terraform |
| NAT Gateway | 1x (cost-optimized) | Terraform |
| Internet Gateway | 1x | Terraform |

### Hardcoded VPC Resource IDs (legacy JSON)
| File | Line | Resource |
|------|------|----------|
| `infrastructure/ecs/shadowsky-service.json` | 9 | `subnet-01ba95f3a849af7de`, `subnet-0d5b07d9422881dca` |
| `infrastructure/ecs/shadowsky-service.json` | 10 | `sg-015e88e8fc86287cc` |

These are management-account VPC resource IDs that will not exist in the member account.

### Secrets Manager
| Secret | Purpose | Managed By |
|--------|---------|------------|
| `shadowsky/anthropic-api-key` | Anthropic API key (currently unused — Workload Identity Federation in place) | Terraform (`infra/site/secrets.tf`) |

### Cognito (Amplify-managed, us-west-1)
| Resource | ID |
|----------|----|
| User Pool | `us-west-1_Huh86iort` |
| User Pool Client | `14b9p1idqctmvsf6t32bfba2jf` |
| Identity Pool | `us-west-1:d2047eb5-7e73-42f6-ab26-170883cf715f` |

### AppSync (Amplify-managed, us-west-1)
| Resource | Endpoint |
|----------|----------|
| GraphQL API | `https://wcionvtp4va5fc4lrci6eczasy.appsync-api.us-west-1.amazonaws.com/graphql` |

### CodeBuild
| Project | Purpose | Managed By |
|---------|---------|------------|
| `shadowsky-api-server-build` | Docker image builder | Terraform (`infra/site/codebuild.tf`) |

### IAM Roles
| Role | Purpose | Managed By |
|------|---------|------------|
| `shadowsky-ecs-execution-role` | ECS task execution (pull images, read secrets, write logs) | Terraform (`infra/site/iam.tf`) |
| `shadowsky-ecs-task-role` | ECS task runtime (STS for Anthropic federation, SSM for ECS Exec, DynamoDB) | Terraform (`infra/site/iam.tf`) |
| `github-actions-deploy-role` | GitHub Actions OIDC deploy | Created outside Terraform; policies managed by Terraform (`infra/site/iam.tf`) |
| `shadowsky-codebuild-role` | CodeBuild service role | Terraform (`infra/site/codebuild.tf`) |

### AWS Amplify
| Resource | ID | Purpose |
|----------|----|---------|
| Amplify App | `d1g6mni4b6812x` | Web frontend hosting (`asphodel.is`, `main.asphodel.is`) |

---

## 3. Data Stores and Migration Methods

| Data Store | Type | Size Estimate | Migration Method |
|------------|------|---------------|------------------|
| `shadowsky-push-tokens` DynamoDB table | DynamoDB (PAY_PER_REQUEST) | Small (per-user push tokens) | DynamoDB export-to-S3 + import, or AWS Backup cross-account restore |
| `shadowsky-trending-production` DynamoDB table | DynamoDB | Small (trending cache, ephemeral) | Recreate empty — data is transient |
| `shadowsky-frontend-{account_id}` S3 bucket | S3 | Small (built frontend assets) | No migration needed — rebuild and deploy to new bucket |
| `shadowsky-build-artifacts-{account_id}` S3 bucket | S3 | Small (30-day lifecycle) | No migration needed — ephemeral build artifacts |
| Cognito User Pool (`us-west-1_Huh86iort`) | Cognito | Unknown | Amplify-managed; redeploy Amplify backend in member account (passwords cannot be migrated — use USER_MIGRATION Lambda trigger if users exist) |
| AppSync GraphQL API | AppSync | N/A (schema only) | Amplify-managed; redeploy |
| Secrets Manager (`shadowsky/anthropic-api-key`) | Secrets Manager | 1 secret | Recreate in member account; repopulate value manually |
| CloudWatch Logs (`/ecs/shadowsky-api-server`, `/codebuild/shadowsky-api-server`) | CloudWatch | Months of logs | Optional: CloudWatch cross-account log sharing or export to S3. Not blocking — new logs accumulate in member account. |
| ECR images | ECR | ~10 images | `docker pull` from old account, `docker push` to new account ECR, or ECR replication policy |

**No RDS instances** are used by this project.

---

## 4. Cross-Project Dependencies

### Pan Labeler Service
- **Reference:** `did:web:labeler.pan.shadowsky.io` in `src/config/pan-labeler.ts:8`, `packages/core/src/atproto/labelers.ts:131`, `mobile/src/config/pan-labeler.ts:8`
- **API calls:** `https://api.shadowsky.io` and `https://api.asphodel.is` serve as API endpoints used by both BSKY and Pan
- **Dependency:** `src/services/pan-api.ts` calls Pan endpoints via `api.shadowsky.io` — if the ALB / DNS moves, Pan's labeler DID resolution (`labeler.pan.shadowsky.io`) must also resolve correctly
- **Migration blocker?** Low — Pan uses AT Protocol DIDs, not AWS resources directly. The `api.shadowsky.io` DNS record just needs to point at the new ALB in the member account.

### Letta Server
- **Reference:** `.claude/CLAUDE.md` contains Letta agent configuration with endpoint `https://app.letta.com/agents/agent-52cede4a-221a-4f9c-a989-57d111191db0`
- **Migration blocker?** No — Letta is a SaaS dependency, not an AWS resource. No account-level binding.

### Shared DNS Zones
- **`shadowsky.io`** (zone `Z1002571THA70GW1RBGB`) and **`asphodel.is`** (zone `Z0676411215OEF4OS4O0X`) are Route53 hosted zones in the management account
- **Migration blocker?** **YES** — Route53 zones must either:
  1. Stay in the management account with cross-account delegation records, OR
  2. Migrate to the member account (requires re-delegating NS records at the registrar)
- This is a hard dependency — the ALB, CloudFront, and Amplify DNS records all live in these zones.

### Shared ACM Certificates
- The ACM cert (`0a173bfe-...`) covers both `shadowsky.io` and `asphodel.is` domains. ACM certs are account-bound and cannot be transferred.
- **Migration blocker?** **YES** — new ACM certificates must be issued in the member account and validated against the domains.

### Amplify App (`d1g6mni4b6812x`)
- The Amplify app is in the management account. It manages the `asphodel.is` web frontend, its own CloudFront distribution, and Cognito/AppSync backends.
- **Migration blocker?** **YES** — Amplify apps cannot be transferred between accounts. A new Amplify app must be created in the member account, the backend redeployed, and custom domains re-associated.

### CloudFront Distribution `E23PU8CFBQFK81`
- Hardcoded in `amplify.yml:48` for cache invalidation on prod deploys
- Belongs to the management account
- **Migration blocker?** Yes — this distribution ID will change when Amplify is redeployed in the member account.

### GitHub Actions OIDC Trust
- The `github-actions-deploy-role` OIDC identity provider is configured in the management account's IAM
- **Migration blocker?** **YES** — see CI/CD section below.

### Crucible / Scaffold Infrastructure
- **No references found.** The BSKY project does not reference `crucible` or `scaffold` infrastructure anywhere in the codebase. This is a clean separation.

---

## 5. CI/CD Authentication

### Current Setup

GitHub Actions authenticates to AWS using **OIDC (OpenID Connect)**:

```yaml
# .github/workflows/deploy-server.yml
permissions:
  id-token: write    # Request OIDC token
  contents: read

- uses: aws-actions/configure-aws-credentials@v6
  with:
    role-to-assume: arn:aws:iam::181691141781:role/github-actions-deploy-role
    aws-region: us-east-1
```

The workflow assumes `github-actions-deploy-role` in the management account via GitHub's OIDC provider. The role's trust policy (not in this repo) allows the GitHub OIDC provider to assume it, scoped to this repo.

The role's permission policies are managed by Terraform in `infra/site/iam.tf`:
- `shadowsky-pass-ecs-roles` — PassRole for ECS execution/task roles
- `shadowsky-deploy` — ECR push, ECS register/update, networking, CloudWatch Logs

### Changes Required for Member Account

1. **Create OIDC identity provider** in `086046210181` — `token.actions.githubusercontent.com` with the GitHub OIDC thumbprint
2. **Create `github-actions-deploy-role`** in the member account with:
   - Trust policy allowing `sts:AssumeRoleWithWebIdentity` from the GitHub OIDC provider, scoped to this repository
   - The same permission policies currently managed by Terraform
3. **Update `.github/workflows/deploy-server.yml`**:
   - Change `AWS_ACCOUNT_ID` from `181691141781` to `086046210181`
   - Change `role-to-assume` ARN to the member account's role
4. **Update `docker/build-push.sh` and `server/deploy.sh`** with the new account ID

### Amplify CI/CD
Amplify has its own build pipeline (configured in `amplify.yml`) that runs inside the Amplify service. When Amplify is recreated in the member account, it automatically gets IAM service roles in that account. The hardcoded S3 bucket name in `amplify.yml:46` must be updated.

---

## 6. Crucible Executor Identity

| Field | Value |
|-------|-------|
| **Task role ARN** | `arn:aws:iam::181691141781:role/crucible-executor-BSKY` |
| **Auth method** | Anthropic Workload Identity Federation (no API key) |
| **Effective date** | 2026-09-03 |

This per-project IAM task role is assumed by BSKY's remote executor (ECS tasks on the Crucible scaffold). Anthropic API access is granted via workload identity federation — no static API key is stored or required. When BSKY moves to the member account (`086046210181`), this role must be re-created there and the federation trust policy updated to match.

---

## 7. Readiness Verdict

### Status: BLOCKED

The BSKY stack **cannot** stand up in the member account until these blockers are resolved:

| Blocker | Severity | Resolution |
|---------|----------|------------|
| **Route53 hosted zones** (`shadowsky.io`, `asphodel.is`) | Critical | Migrate zones to member account OR set up cross-account delegation |
| **ACM certificates** | Critical | Issue new certs in member account (requires DNS validation via the zones above — resolve zone migration first) |
| **GitHub OIDC provider + deploy role** | Critical | Create OIDC provider and IAM role in member account |
| **Amplify app** | High | Create new Amplify app in member account, redeploy backend, re-associate custom domains |
| **CloudFront distribution ID** (`E23PU8CFBQFK81`) | Medium | Will change when Amplify is recreated; update `amplify.yml` |
| **13 hardcoded account ID references** | Medium | Parameterize with env vars / Terraform variables (follow-up task) |
| **Legacy JSON files** (`infrastructure/ecs/*.json`) | Low | These appear to be pre-Terraform configs; consider deleting if Terraform is authoritative |
| **Cognito user migration** | Low (if no users) | Use USER_MIGRATION Lambda trigger if existing users need to sign into new pool |

### Recommended Migration Order

1. DNS zones (prerequisite for everything)
2. ACM certificates (requires DNS)
3. OIDC provider + deploy role in member account
4. Terraform `apply` in member account (VPC, ECS, ECR, ALB, S3, DynamoDB, Secrets, CloudFront)
5. Amplify app creation + backend deploy
6. Parameterize all 12 hardcoded account IDs
7. Update CI/CD workflow to target member account
8. DNS cutover (point records at new ALB/CloudFront)
9. Verify, then decommission management-account resources
