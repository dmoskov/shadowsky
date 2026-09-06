# Proposed retirement retention policy

Recommended on 2026-09-06. This is a proposal, not an applied deletion schedule. No retained data or storage is authorized for deletion by this document.

| Asset | Recommended retention | Review date / action |
| --- | --- | --- |
| Git source/history, retirement configuration, sanitized inventory | Indefinite | Keep repositories; no automatic deletion. |
| `shadowsky.io`, `asphodel.is`, PAN feed data, DNS, certificates, shared storage and processing | Indefinite / existing PAN policy | Exclude from all Asphodel retirement expiration rules. |
| Empty DynamoDB tables, empty Cognito pool, obsolete sandbox data/auth stacks and their helper resources | 30-day recovery period | On 2026-10-06, recheck emptiness and backup availability, then request approval to delete the unused containers and helper resources. Keep the final backup separately. |
| Routine application/build logs, redundant build artifacts and older ECR images | 90 days from retirement | Review on 2026-12-05. Preserve one final production/staging build and one final usable image before deleting redundant copies. |
| Final table backups, final deployment packages, Terraform state, dependency snapshots and retirement evidence | One year from retirement | Review on 2027-09-06; retain longer only for a named restoration or investigation need. Keep one encrypted, access-restricted archive. |
| Logs or snapshots needed for an ongoing investigation | At least one year, and until the investigation owner releases them | Exempt explicitly identified evidence from routine expiration. |
| Retired credentials | No active retention | AWS stores have been removed from active use; the tested archived sandbox key is rejected by Anthropic. Historical sensitive copies follow the restricted evidence-archive policy. |

The tables and user pool were empty at retirement, so keeping their full operating stacks indefinitely provides little recovery value. A 30-day review period plus the final backups provides time to catch an overlooked dependency. Routine build/log copies have diminishing value after 90 days. A one-year final archive preserves a practical restoration/audit trail without keeping every operational resource indefinitely.

Implementation after approval:

1. Inventory both current and noncurrent S3 object versions and identify the final artifacts to retain. Keep a restore manifest and verify archive checksums/readability.
2. Store final evidence in a dedicated prefix with encryption, versioning, and restricted access. Keep Terraform state with its sensitive-data protections.
3. Apply separate lifecycle policies to final evidence and disposable artifacts. In versioned S3 buckets, current-object expiration alone creates a delete marker and leaves old versions; any intended purge must explicitly handle noncurrent versions and expired delete markers. See [AWS expiration documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html).
4. Export any logs selected for longer retention before changing CloudWatch retention. Retention changes can remove old entries immediately; use a retirement-date cutoff rather than assuming a new rule starts a fresh grace period.
5. Delete encryption keys only after confirming no retained encrypted object or log needs them. Preserve the shared regional API Gateway logging role unless all consumers are verified absent.
6. Obtain explicit approval for each data-deletion batch. This proposal does not alter the current `prevent_destroy` protections, backup retention, or PAN policies.
