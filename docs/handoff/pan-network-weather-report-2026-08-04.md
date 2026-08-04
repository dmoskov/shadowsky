# Pan → Asphodel: Network Weather status report

**Date:** 2026-08-04
**From:** Asphodel (BSKY) side, after end-to-end verification against production
**Access used:** read-only. `pan-bastion` (us-east-1) → `pan-db`. `SELECT` only; no writes, no schema changes.

---

## Executive summary

Network Weather has never worked in production. Not because of a design problem — the
pipeline, the endpoints, and the client are all substantially correct. **One
infrastructure regression explains essentially all of it.**

> `pg_cron` is not in `shared_preload_libraries` on `pan-db`, so every scheduled
> database job has silently done nothing since **2026-03-28** — four months.

Fixing that is a parameter-group edit plus a reboot. Everything else in this report is
either downstream of it or a small correctness fix.

Asphodel is no longer blocked: the client was repointed at working endpoints and now
degrades honestly when signal is absent. But the feature shows nothing useful until
Pan's side is repaired.

---

## 1. Root cause: pg_cron is not loaded

**Priority: P1. Effort: small. This is the whole ballgame.**

Parameter group `pan-pg17`:

```
shared_preload_libraries = pg_stat_statements     (Source: user, ApplyMethod: pending-reboot)
```

Live on the instance: `rdsutils, pg_stat_statements, rds_casts` (the other two are
RDS-injected).

`pg_cron`'s scheduler is a **background worker** and requires being listed in
`shared_preload_libraries`. The extension is installed, `cron.job` is readable, and
every job reports `active = true` — but nothing ever runs. There is no error, no log
line, and no failed status. From the job table it looks perfectly healthy.

All three jobs stopped on the same day:

| jobid | jobname | schedule | last run |
|---|---|---|---|
| 2 | `partman-maintenance` | `0 3 * * *` | 2026-03-28 03:00 |
| 3 | `narrative-hygiene` | `0 4 * * *` | 2026-03-28 04:00 |
| 4 | `narrative-crossings-refresh` | `30 4 * * *` | 2026-03-28 04:30 |

`cron.job_run_details` has no rows after 2026-03-28 for any job.

The parameter group name (`pan-pg17`) plus the timing strongly suggest a PostgreSQL 17
major-version upgrade or instance replacement around that date, whose new parameter
group omitted `pg_cron`.

### Fix

1. Set `shared_preload_libraries = pg_cron,pg_stat_statements` on `pan-pg17`.
2. **Reboot `pan-db`.** The parameter is static; it will not apply dynamically.
3. Confirm `cron.database_name` resolves to `jetstream` (currently absent).
4. Verify jobs fire — new rows in `cron.job_run_details`.
5. Run the two narrative jobs once manually to catch up rather than waiting for
   04:00/04:30 UTC. **See the warning in §2 before running the hygiene job.**

### Also worth adding

Nothing alerts on pg_cron liveness. A single check — "does `max(start_time)` per job
fall inside its expected interval?" — would have caught this in a day instead of four
months. Recommend adding it as part of the fix.

---

## 2. Consequence: narrative labels have collapsed

**This is what actually breaks Network Weather for users.**

`narrative-hygiene` runs `prune_inactive_narratives(3, 7)`. Its second step **merges
duplicate-named narratives**, keeping the highest `post_count` per name and setting the
rest to `status = 'merged'`. With that dead for four months, duplicates accumulate
without bound.

Label diversity by week of narrative creation:

| week | clusters created | distinct names |
|---|---|---|
| 2026-06-08 | 59 | **46** ← healthy |
| 2026-07-13 | 836 | 7 |
| 2026-07-20 | 2,762 | 4 |
| 2026-07-27 | 8,172 | 6 |
| 2026-08-03 | 2,783 | 4 |

In the last 24 hours: **1,771 narrative rows carrying 4 distinct labels.**

| label | clusters | posts | authors |
|---|---|---|---|
| Father's Plea for Areen | 1,091 | 29,776 | 27,022 |
| Father's Plea for Son Areen | 460 | 10,963 | 10,266 |
| Father's Plea for Areen's Survival | 219 | 6,253 | 5,465 |
| Father's Plea for Displaced Son | 1 | 20 | 15 |

`/api/narratives` ranks by `author_count DESC` and returns 50 rows, so Asphodel
receives 50 rows carrying **3 distinct labels**. The textile needs 3+ *distinct*
threads to mean anything, so it can never render a real picture.

Simulating the hygiene job read-only:

```
active narratives                      23,478
would be merged if it ran now          20,137
would remain                            3,341
would be deactivated (post_count < 3)  10,522
```

3,341 lines up with the ~3,971 distinct names in the table historically, which is good
evidence the fix restores the intended state.

> **Warning before running it:** this is a bulk status change on ~20k rows. Take a
> snapshot first and consider batching. Please don't run it casually right after the
> reboot.

### The pipeline itself is healthy — worth being clear about this

- ~1,400 narratives created per day; 1,312 today.
- `mv_narrative_weather` is refreshed hourly by the **trending processor** (an ECS
  service, not pg_cron), so it is current.
- `post_narratives`: 1,888,885 rows, 339,340 in the last 7 days.

The data is fine. Only the deduplication step is missing.

### One open question for Pan

Is 1,771 clusters for what appears to be one story the intended behaviour of the
clusterer, or is that itself over-fragmentation? Merging by exact name will collapse
them, but three of the four labels are *near*-duplicates of each other
("...for Areen", "...for Son Areen", "...for Areen's Survival"), which exact-name
matching will **not** merge. Asphodel now dedupes client-side by significant-word
containment as a defensive measure, but that is a client papering over a server-side
clustering question. Worth a look.

---

## 3. Consequence: `/api/narratives/crossings` is permanently empty

```
narrative_author_summary        0 rows
mv_narrative_crossings          0 rows
post_narratives             1,888,885 rows (339,340 in last 7 days)
```

`narrative-crossings-refresh` `TRUNCATE`s `narrative_author_summary` and repopulates
it. It last ran 2026-03-28 — and its runtime had already collapsed from ~9 minutes
(03-21, 03-22) to ~50 ms (03-24 onward), i.e. it was doing no real work even before it
stopped entirely.

Running the summary query by hand right now returns **339,344 rows**, so the source
data is present and the query is correct. The table is simply never refilled.

This should resolve itself once §1 is fixed. Two independent bugs remain in the
endpoint though:

### 3a. `computed_at` is the request timestamp, not the refresh time

`routers/narratives.py:608` uses:

```sql
SELECT pg_stat_get_last_analyze_time(c.oid) FROM pg_class c
WHERE c.relname = 'mv_narrative_crossings'
```

That is the last **ANALYZE**, not the last **REFRESH MATERIALIZED VIEW**. It returns
NULL here, so the code falls back to `datetime.now(timezone.utc)`. Three consecutive
requests two seconds apart returned three different `computed_at` values.

The effect is worse than useless: it implies the data is current when it may be months
stale. Consider tracking refresh time explicitly (a small `mv_refresh_log` table
written by the refresh job) rather than inferring it from `pg_stat`.

### 3b. `min_shared` cannot go below the MV's own floor

The endpoint declares `min_shared: int = Query(5, ge=1)`, and migration 079's MV bakes
in `HAVING COUNT(*) >= 3`. So values below 3 are silently ineffective, and `0` is
rejected outright with a 422. Either document the floor or clamp explicitly — as-is it
sends anyone debugging down a false path. (It sent me down one; see §6.)

### 3c. Response shape vs. the agreed contract

The Asana spec for this endpoint documented a top-level
`{ crossings, computed_at, count }`. Production returns it wrapped:
`{ success, data: { ... }, meta }`.

This is **not** a Pan bug — `create_api_response()` is the API's standard envelope.
But Asphodel was written to the spec and read `resp.crossings`, which is always
`undefined` against the real response. That is the single reason narratives resolved to
empty for every Asphodel user for months. Recommend updating the contract doc so the
next consumer doesn't repeat it. `bridge_posts` from the spec could not be verified
(array is empty).

---

## 4. Consequence: partition retention is not running

`partman-maintenance` (`CALL public.run_maintenance_proc()`) is also dead.

`public.events` is partitioned monthly: `premake=3`, `retention=12 months`,
`infinite_time_partitions=false`.

**Not currently an outage.** `events_p*` partitions exist through 2026-11-01, so writes
succeed and there is no imminent failure. But 12-month retention has not been enforced
since March, so old partitions accumulate. Worth checking disk headroom, and worth
noting that if the fix slips past ~November this becomes a write-failure risk.

---

## 5. Independent of pg_cron: two smaller items

### 5a. `volume_ratio` missing from `/api/sentiment/latest`

The payload contains `avg_sentiment`, `positive_count`, `negative_count`,
`neutral_count`, `overall_sentiment`, `sentiment_variance`, `dominant_category`,
`timestamp` — but **no `volume_ratio`**.

Asphodel's energy calculation is
`(log2(volume_ratio * avgCountRatio) + 1) / 4`. With `volume_ratio` absent it defaults
to 1, which reduces energy to a function of `count_ratio` alone and **saturates at an
average count ratio of 8** — a level live data sits at routinely (measured: 8.115 →
1.005 → clamped to 1.0).

Asphodel now detects this and reports energy as neutral-and-unreliable rather than
asserting a confident 1.0, and the written weather report drops its energy clause
entirely. So nothing is *wrong* user-facing — the signal is just absent.

Either add `volume_ratio` to the sentiment payload, or tell us it's intentionally gone
and we'll drop energy from the model rather than carry a dead input.

Related: `/api/narratives` returns `network_energy: 1.0` exactly — also saturated.
Asphodel treats `>= 1` as unmeasured and substitutes a neutral luminance. Same
question: is that value meaningful, or should we stop reading it?

### 5b. `main.asphodel.is` is not in the CORS allowlist

```
Origin: https://asphodel.is        → access-control-allow-origin: https://asphodel.is
Origin: https://www.asphodel.is    → access-control-allow-origin: https://www.asphodel.is
Origin: https://main.asphodel.is   → (no allow-origin header)
```

Every Pan-backed feature is therefore dead on Asphodel's **staging** environment and
silently falls back (the client has a circuit breaker by design). The practical cost:
we cannot verify any weather or trending change on staging before promoting to
production. During the 2026-08-03 deploy the weather work had to be validated directly
against production — exactly what staging exists to prevent.

Please add `https://main.asphodel.is`, and consider whether `*.asphodel.is` is
acceptable for this API's threat model to cover future preview domains.

---

## 6. Corrections to earlier claims

In the interest of not sending anyone down paths I already eliminated — several of my
initial hypotheses were wrong, and are corrected in the Asana tickets:

| Earlier claim | Reality |
| --- | --- |
| "Narrative data is stale, ~13 days old" | Wrong. `age_hours` is the *cluster's* age; a 13-day-old cluster still receiving posts is legitimate. Creation is healthy at ~1,400/day. |
| "The 7-day window in migration 079 excludes everything" | Wrong. 339,340 `post_narratives` rows fall inside it. |
| "Only 6 of 50 narratives are active" | Wrong. 23,478 are active. The "6" was the API response's `is_active` field on 50 returned rows, not `narratives.status`. |
| "Zero crossings even with all filters removed" | Invalid test. `min_shared=0` returns 422 (`ge=1`); I misread the empty body as a zero result. |
| "`HAVING >= 5` is the floor" | Superseded. Migration 079 rebuilt the MV with `HAVING >= 3` and switched from post-overlap to author-overlap. |
| "`narrative_posts` may be unpopulated" | Wrong table (`post_narratives`) and wrong conclusion — it is well populated. The empty table is `narrative_author_summary`. |

---

## 7. Recommended order of work

| # | Item | Priority | Effort |
|---|---|---|---|
| 1 | Add `pg_cron` to `shared_preload_libraries`, reboot `pan-db` | **P1** | S |
| 2 | Verify all three jobs fire; add a pg_cron liveness alert | **P1** | S |
| 3 | Catch-up run of `narrative-hygiene` (snapshot first, batch the ~20k merge) | **P1** | S |
| 4 | Confirm `/api/narratives` label diversity and non-empty crossings | P1 | S |
| 5 | Add `main.asphodel.is` to CORS | P2 | S |
| 6 | Fix `computed_at` to reflect real refresh time | P2 | S |
| 7 | Decide on `volume_ratio` / `network_energy` — provide or retire | P2 | S |
| 8 | Clamp or document the `min_shared` floor | P3 | S |
| 9 | Update the crossings contract doc for the response envelope | P3 | S |
| 10 | Check `public.events` disk headroom given unenforced retention | P3 | S |
| 11 | Consider near-duplicate clustering (see §2) | open question | ? |

Items 1–4 are one sitting and unblock the feature. 5 unblocks our ability to test it.

---

## 8. Asana tickets

- `[pan] ROOT CAUSE: pg_cron dropped from shared_preload_libraries` — 1217171573451630
- `[pan] /api/narratives/crossings returns 0 crossings in production` — 1217171275108968
  (carries the §6 corrections as a comment)
- `[pan] Add main.asphodel.is to the API CORS allowlist` — 1217171144474094
- Original endpoint task, closed complete 2026-03-14 — 1213636953055387
  (commented with why it never delivered)

## 9. Note on Pan's own docs

`pan/BASTION_SETUP.md` was stale and cost real time: it documented a us-west-2 bastion
(`i-0f7880640d46167e8`) and RDS (`pan-2-usw2`) that no longer exist, so the documented
path just times out. The live pair is `pan-bastion` + `pan-db` in **us-east-1**, user
`jetstream`, password in Secrets Manager at `pan/db-password`. The `DB_PASSWORD` in
`.env` is stale and fails auth, as does connecting as `postgres`.

I've updated that file in the pan repo (uncommitted, for you to review). Note
`bastion_tunnel.sh` still carries the old us-west-2 values and was left alone.
