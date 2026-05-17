# TPJ Image Strategy & Cutover Runbook

Two phases. Phase A is the speed win, Phase B is the cost win. Do them
separately so each is independently revertable.

---

## What landed in code (already done, in `main`)

1. `TpjImage` is now the single render surface for every WP-media `<img>`
   on the site. Five call sites: `HomepageHero`, `ThemeThumbnail`,
   `Hero`, `InterviewQuoteRotator`, `PhotographerAvatar`, plus the 404
   fallback. Static SVGs/PNGs in `/public` correctly stay as plain `<img>`.
2. `lib/media.ts` exports `prepareArticleBodyHtml(html)` — composes
   `rewriteMediaUrlsInHtml` (URL canonicalisation) with the new
   `rewriteArticleBodyImages` rewriter. Server-side regex pass over
   WP-rendered `<img>` tags that injects CDN `src` + responsive
   `srcset` + `sizes` + `loading="lazy"`. No-op when
   `NEXT_PUBLIC_CDN_BASE` is unset. Wired into `essay-by-slug`,
   `interview-by-slug`, `feature-by-slug`.
3. `.env.example` documents the new env var.
4. Lime card-title hover underline removed (separate, unrelated commit).

Everything is gated. Without `NEXT_PUBLIC_CDN_BASE` set, all behaviour
is identical to today. Flip the env var and Cloudflare takes over.

---

## Phase A — Cloudflare CDN cutover (low-risk, staged before production)

**Full step-by-step walkthrough lives in `CDN_SETUP.md`.** This section
summarises the architecture choice and the change in approach from
the earlier draft of this doc.

### A1. URL reality (DB audit 2026-05-14)

Audited the local DB (a copy of production) to verify URL shapes
before designing the cutover. Confirmed:

- **Attachment GUIDs** all point at
  `https://thephotographicjournal.com/wp-content/uploads/...`.
- **In-content `<img src>`** values come in three shapes:
  - canonical `https://thephotographicjournal.com/wp-content/uploads/...`
  - bare relative `/wp-content/uploads/...` (no host)
  - legacy `http://tpj.wpengine.com/wp-content/uploads/...` (~64 articles)
- **Zero direct S3 or CloudFront URLs in DB content.** Image URLs are
  presented to visitors as `thephotographicjournal.com` URLs, which
  means WPEngine receives every image request and proxies internally
  to S3. This is the source of the ~135 GB/month WPEngine bandwidth.

### A2. Architecture decision (revised 2026-05-16)

**CNAME target is the S3 bucket directly, not the WP origin.** The
earlier draft of this doc recommended pointing `media` at
`thephotographicjournal.com` so Cloudflare would pull from the WP
host. That approach works but preserves the problem we're trying
to solve: Cloudflare cache-miss requests still flow through WPEngine,
which is exactly the cost path we want to eliminate.

The corrected architecture:

```
visitor → media.thephotographicjournal.com → Cloudflare → S3 → Cloudflare → visitor
```

S3 serves the same `wp-content/uploads/...` path structure that WP
Offload Media Lite uploads into. The frontend code in `lib/cdn.ts`
strips the host from incoming URLs and rebuilds them against
`{base}/cdn-cgi/image/.../wp-content/uploads/...`, so the path
already aligns. No frontend code changes needed; only the CNAME
target and an Origin Rule to override the S3 Host header.

### A3. Staged before production

The full walkthrough in `CDN_SETUP.md` introduces a `media-staging`
subdomain that mirrors the production setup but receives no
visitor traffic. Local dev points at staging via `NEXT_PUBLIC_CDN_BASE`,
the full image pipeline is validated, then production cutover is
the addition of a parallel `media` CNAME plus the Vercel env var.

### A4. Expected outcome

| Metric | Before | After |
|---|---|---|
| WPEngine bandwidth | ~135 GB/month (at 90% of Professional cap) | ~5–15 GB/month |
| WPEngine visit count | ~8.5k/month | ~500–2k/month (admin + ISR) |
| Cloudflare cost | $0 | ~$22–28/month (Pro plan + transform fees) |
| WPEngine plan after downgrade | Professional $65 | Startup ~$25 |
| Net monthly change | — | ~$18 savings, plus the bandwidth ceiling removed |

For the actual procedure (account setup, S3 info gathering, staging,
production cutover, validation, rollback at each step), follow
`CDN_SETUP.md`.

---

## Phase B — S3 → R2 (cost reduction, deferred until Phase A is stable)

### Why later, not now

R2's win is zero egress fees. That matters at scale and doesn't matter
for correctness. Don't change two things at once. Run Phase A for at
least a couple of weeks, watch the CDN behave, then do this.

### B0. First, identify the prod S3 plugin

Phase B needs to know what currently moves uploads into S3 on the WP
host. The local install doesn't have it (only ACF + WPGraphQL +
WPGraphQL-ACF are active locally), so check the **production** WP
admin → Plugins. Likely candidates:

- **WP Offload Media** (Delicious Brains, most common)
- **S3 Uploads** (humanmade)
- **Media Cloud** / **ILAB Media Tools**
- **W3 Total Cache** with the CDN tab pointed at S3
- Or no plugin at all — could be an s3fs mount or filesystem proxy at
  the web-server level.

Note the plugin name + version, the S3 bucket name, and the region.
That's the input for B3.

### B1. Create R2 bucket

Cloudflare dashboard → R2 → Create bucket. Suggested name: `tpj-media`.

### B2. Migrate data with rclone

```bash
brew install rclone
rclone config  # add 's3' remote (existing AWS creds) and 'r2' remote (R2 API token)
rclone copy s3:<your-bucket> r2:tpj-media --progress
rclone check s3:<your-bucket> r2:tpj-media  # verify
```

Expect 30min–several hours depending on archive size. Re-runnable —
`copy` skips files already present.

### B3. Update WP upload plugin

Point the plugin identified in B0 at R2's S3-compatible endpoint:

- Endpoint URL: `https://<your-cf-account-id>.r2.cloudflarestorage.com`
- Access key / secret: R2 API token (create one in R2 settings)
- Bucket: `tpj-media`
- Region: `auto`

Upload one test image through WP admin. Verify it lands in R2 (check
bucket contents in CF dashboard).

If production turns out to be running s3fs / mount-based S3 (no
plugin), Phase B becomes: change the mount target from S3 to R2's
S3-compatible endpoint. Same conceptual move, different mechanic.

### B4. Repoint the CDN

Two options:

- **R2 custom domain (recommended).** R2 bucket → Settings → Custom
  Domains → add `media.thephotographicjournal.com`. R2 handles DNS for
  you and routes through Cloudflare's edge automatically. Image Resizing
  still applies.
- **Manual CNAME.** Change the existing `media` CNAME to point at the
  R2 public bucket URL. Keep proxy enabled.

### B5. Verify, then drain S3

After a week of clean R2 serving with no S3 reads: delete the S3 bucket
or move it to Glacier Deep Archive for forensic backup.

### B6. Phase B rollback

If R2 reads ever fail: flip the CNAME back to the S3 origin. R2 stays in
place for retry. The WP plugin keeps writing to R2 either way; new
uploads land in R2 even if the read path is temporarily back on S3
(they won't be readable until you flip back). Acceptable for a
short-window rollback; if you're sitting in rollback for >24h, also
revert the plugin config.

---

## Cost ballpark

| Item                          | Today (S3 direct or via CloudFront) | After Phase A | After Phase B |
| ----------------------------- | ----------------------------------- | ------------- | ------------- |
| Storage (100GB archive)       | ~$2.30/mo                           | ~$2.30/mo     | ~$1.50/mo     |
| Egress (1TB/mo outbound)      | ~$90/mo                             | ~$90/mo       | $0            |
| Image transforms              | $0                                  | $5–15/mo      | $5–15/mo      |
| **Estimated monthly total**   | **~$92**                            | **~$100**     | **~$7**       |

Phase A costs slightly more in absolute terms (transform fee) but
delivers responsive images + format conversion. Phase B is where the
real savings land.

---

## Audit appendix — DB findings 2026-05-14

Sampled the local DB (a copy of production) to verify in-content URL
shapes before designing the cutover. The article-body rewriter
(`rewriteArticleBodyImages` in `lib/media.ts`) only fires on URLs that
`rewriteMediaUrlsInHtml` first canonicalises to the prod origin, so
this audit was about confirming no surprise URL shapes exist.

| URL pattern in `post_content`                                     | Article count |
| ----------------------------------------------------------------- | ------------- |
| `https://thephotographicjournal.com/wp-content/uploads/...`       | 343           |
| Bare `/wp-content/uploads/...` (no host)                          | 362           |
| `http://tpj.wpengine.com/wp-content/uploads/...` (legacy staging) | 64            |
| `s3.amazonaws.com`                                                | **0**         |
| `cloudfront.net`                                                  | **0**         |

All three present shapes are handled by `rewriteMediaUrlsInHtml`
(canonicalised to the prod origin) before the CDN rewriter runs, so
**every in-content image will pick up the CDN treatment post-cutover**.
No code changes needed.

If a future post somehow gets authored with a direct-S3 or CloudFront
URL (e.g. a copy-paste from elsewhere), the rewriter will fall through
and that image will load uncached without transforms. To catch it: add
a branch to `rewriteMediaUrl` in `lib/media.ts` for the offending host.

---

## Quick reference — files touched in this branch

```
frontend/components/Hero.tsx
frontend/components/InterviewQuoteRotator.tsx
frontend/components/PhotographerAvatar.tsx
frontend/app/not-found.tsx
frontend/lib/media.ts
frontend/lib/queries/essay-by-slug.ts
frontend/lib/queries/interview-by-slug.ts
frontend/lib/queries/feature-by-slug.ts
frontend/.env.example
frontend/.gitignore
```

Plus the unrelated card-underline removal in
`ArticleCard.tsx/.module.css`, `ThemeIndexCard.tsx`,
`ThemesIndex.module.css`, `lib/card-motion.ts`.
