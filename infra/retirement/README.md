# Hosted infrastructure retirement — 2026-09-06

Asphodel/ShadowSky hosting and application compute are retired. Source and domains remain. No retained table, bucket, image repository, log group, user pool, or encryption key was deleted. Explicit project deployment workflows remain disabled; the legacy GitHub-managed Pages workflow is an exception described below.

## Removed

- `shadowsky-api-server` ECS service, task definition managed by Terraform, and `shadowsky-cluster` in us-east-1. Service had zero desired, running, and pending tasks before removal; cluster is now INACTIVE.
- Legacy ShadowSky VPC `vpc-0806b9425061b2adb`, four subnets, NAT gateway, elastic IP, internet gateway, route tables/associations, and its two security groups. Only the NAT interface remained; no workload interfaces, VPC peerings, or transit gateway attachments used this VPC.
- `shadowsky-api-server-build` CodeBuild project and its role, ECS execution/task roles and policies, plus the repository-only `github-actions-deploy-role`. GitHub role trust was limited to `dmoskov/shadowsky`.
- Amplify app `d1g6mni4b6812x`, production/staging hosting, and its Asphodel hosting domain association. No backend environments or branch backend attachments existed. The separate retained sandbox was not attached to this app.
- `AmplifyServiceRole-ShadowSky`, its administrator managed-policy attachment, and CloudFront invalidation policy. All 17 enabled regions were checked successfully; no remaining Amplify app consumed this role.
- GitHub Amplify push webhook `561108177`. No repository Actions secrets were listed.
- Disabled CloudFront distributions `E22AUQHZGDBNK`, `E1FRQ5R58RZE6C`, and `E23PU8CFBQFK81`; Terraform-managed SPA rewrite function and origin access control; obsolete frontend bucket CloudFront grant. The empty `ShadowSkyCloudFront` stack was also removed.
- Terraform-managed API/apex/www hosting DNS records. Hosted zones, domains, feed records, certificate validation, mail, and TXT records were preserved.
- Sandbox REST API `zrrj54yph3`, its methods/stage/deployment and Lambda permissions; scheduled-post processor and warmup rules; twelve application Lambdas and their twelve dedicated roles; obsolete AI monitoring stack.
- Build artifact and container image expiration policies, to preserve retained artifacts. Terraform-managed log retention is now indefinite.

## Shared PAN load balancer

Removed only Asphodel forwarding rules at priorities 20, 40, 50, 51, 52, and 53, and the empty `pan-shadowsky-http-tg` and `pan-shadowsky-ws-tg` target groups. Both groups belonged to the stopped Asphodel service.

All retained listener rules were compared before/after and are identical. Listeners and their default certificates are identical. Feed DNS and certificate-validation records in both zones are unchanged. Feed/labeler routing, the shared ALB, PAN target groups, certificates, and processing were not changed by this retirement.

PAN configuration commit `227eb0b` was pushed to `dmoskov/pan` main from an isolated checkout. It removes only the retired Asphodel target groups/rules. The active PAN task was notified; its existing uncommitted work was left untouched and must be merged with that remote commit before a future PAN apply.

The request referred to 25 feeds. Before this task changed shared infrastructure, the separately authorized **Pan Curated** retirement had already reduced the advertised set to 24. This was confirmed in the completed “Remove unnecessary image processing” task. Every one of the remaining 24 feeds returned posts on **both** `feed.shadowsky.io` and `feed.asphodel.is`, before and after the ALB cleanup. This task did not restore Pan Curated or change PAN processing.

Recheck with `python3 infra/retirement/verify-feeds.py`. It reads all advertised feed skeletons without publishing anything.

## Backups and retained resources

Durable encrypted archive:

`s3://shadowsky-frontend-181691141781/retirement-2026-09-06/retirement-backup.tar.gz`

The initial archive is 27,664,727 bytes, encrypted with AES256, version `dBo6h4FGNIz8Or_ClPl57uDJmG0Gz5KQ`. It includes deployed production/staging web artifacts, application Lambda packages, infrastructure/configuration snapshots, prior Terraform state, DNS and dependency inventories, and the original local diff. Treat it as sensitive: configuration snapshots can contain credentials. The bucket blocks all public access and has versioning enabled.

On-demand DynamoDB backups named `retirement-2026-09-06` are AVAILABLE for:

| Region | Retained table | Backup ID |
| --- | --- | --- |
| us-east-1 | shadowsky-push-tokens | 01788720234892-35de20df |
| us-west-1 | shadowsky-scheduled-posts | 01788720233618-92618d12 |
| us-west-1 | shadowsky-alt-text-cache | 01788720234148-7ab64109 |
| us-west-1 | Todo-zpixlc2h3vd37hkiv575c5syzq-NONE | 01788720464329-49bf5d92 |

All four tables scanned as empty. The scheduled-post table was empty before cleanup; its one-minute rule was disabled and processor concurrency set to zero before removal. No function was invoked and no queued content was published. Cognito user pool `us-west-1_Huh86iort` contained zero users and is retained.

Also retained:

- `shadowsky-frontend-181691141781` and `shadowsky-build-artifacts-181691141781` S3 buckets and all existing objects.
- Both sandbox data/schema S3 buckets, AppSync/data stack, authentication stack, four CloudFormation data-management helper Lambdas, and their supporting roles/state machine.
- Sandbox security stack and KMS key, plus the regional API Gateway logging account/role because its scope may be shared.
- `shadowsky-api-server` ECR repository and images; existing application/build/sandbox logs.
- Credential follow-up: the user confirmed the Anthropic credentials have no shared consumers and authorized deletion. The sandbox `ANTHROPIC_API_KEY` SSM parameter was deleted; `shadowsky/anthropic-api-key` was removed from Terraform and scheduled for deletion using its existing seven-day recovery window. The secret is unavailable to normal retrieval during that window. These operations do not revoke the underlying Anthropic key; Console access requires sign-in. Protected historical backups can still contain credential copies.
- Shared PAN databases/storage, feed infrastructure, domains, certificates, and DNS. No Asphodel-only RDS instance was found in us-east-1/us-west-1; unrelated and PAN databases were untouched.

The retained sandbox root stack is `amplify-bskynotificationsapp-moskov-sandbox-9587f5d9f6`; its update finished `UPDATE_COMPLETE`. `sandbox-retained-template.json` is the applied CloudFormation template. Retained root resources have `Retain` deletion/replacement policies. Do not redeploy the old Amplify backend definition.

## Terraform and local work

`infra/site` now contains only retained-resource configuration with `prevent_destroy`. The temporary plan/apply rejection variable is gone. A normal apply completed with **0 added, 2 changed, 40 destroyed**, and a subsequent ordinary refreshed plan returned **No changes**. Existing deployment workflows and deployment-script guards remain disabled.

Changes were prepared from current remote main in an isolated checkout to preserve the original BSKY working tree. Original uncommitted work was not reset, stashed, or committed. Its old Terraform configuration/state must not be used after retirement; use the new main configuration and the latest state at `s3://shadowsky-frontend-181691141781/retirement-2026-09-06/terraform-final.tfstate`. Old deploy inputs are no longer needed.

## Still unresolved / intentionally deferred

1. **Lambda@Edge propagation:** `shadowsky-og-meta-edge:5` still has AWS-managed replicas. Both associated legacy distributions are gone, but AWS rejects function deletion until replicas clear. The edge function, version/role, and `ShadowSkyOgMetaEdge` stack remain; retry cleanup after AWS propagation. Do not remove shared CloudFront/ACM resources.
2. **Legacy GitHub Pages:** GitHub returns HTTP 422 for both workflow disabling and Pages-site deletion. `https://dmoskov.github.io/shadowsky/` currently redirects to the retired `http://shadowsky.io/`. The old `gh-pages` source and Pages registration remain; repository/admin settings need resolution. Explicit deployment workflows are disabled.
3. **Retention decisions:** tables, buckets, images, logs, Cognito/data stacks, helper functions, and encryption remain. Their deletion requires explicit approval even though the tables/user pool are empty.
4. **Anthropic-side revocation:** AWS credential-store cleanup is complete following explicit user authorization. Provider-side key revocation remains pending an authenticated Anthropic Console session or admin API access; the available Console session is signed out. Historical protected backups were preserved. Scoped deployment IAM roles and the Amplify webhook are already removed.
5. **Shared PAN ancillary configuration:** the Asphodel-specific security group and stopped-service alarm/OOM rule still exist in PAN's configuration, including a grant to the shared alerts topic. They were kept outside the requested ALB route/target-group change. Do not remove the shared topic or PAN monitoring.
