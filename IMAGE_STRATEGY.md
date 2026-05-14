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

## Phase A — Cloudflare CDN cutover (low-risk, deploy when ready)

### A1. URL reality (already confirmed 2026-05-14)

Audited the local DB (a copy of production) to verify URL shapes
before designing the cutover. Confirmed:

- **Attachment GUIDs** all point at
  `https://thephotographicjournal.com/wp-content/uploads/...`.
- **In-content `<img src>`** values come in three shapes:
  - canonical `https://thephotographicjournal.com/wp-content/uploads/...`
  - bare relative `/wp-content/uploads/...` (no host)
  - legacy `http://tpj.wpengine.com/wp-content/uploads/...` (~64 articles)
- **Zero direct S3 or CloudFront URLs.** Whatever S3 plugin runs in
  production (likely **WP Offload Media**, but we don't need to know
  for Phase A) handles S3 as a storage backend — every in-content URL
  stays on the WP origin.

This means Cloudflare can sit in front of the WP origin and pull images
from there. We don't need to know the S3 bucket name, region, or
endpoint for Phase A. Phase B needs that info; Phase A does not.

`rewriteMediaUrlsInHtml` in `lib/media.ts` already canonicalises all
three shapes to the prod origin, so `rewriteArticleBodyImages` picks
them up uniformly.

### A2. Cloudflare zone

If `thephotographicjournal.com` isn't on Cloudflare nameservers yet:
add it (Free plan is fine to start), copy the two NS records they give
you, update them at your registrar. DNS propagation 5min–24hr.

If it's already on Cloudflare, skip.

### A3. DNS — add `media` subdomain

In Cloudflare → DNS → Records → Add:

- Type: `CNAME`
- Name: `media`
- Target: `thephotographicjournal.com` (the WP origin). Cloudflare
  pulls images from the WP host; whatever the WP host does with S3
  internally is invisible to us.
- Proxy status: **Proxied (orange cloud)**. Critical — without this
  Cloudflare can't transform images.

*Note: this routes image cache-miss reads through the WP host. For a
heavily-trafficked WP host that's a real load consideration, but
Cloudflare caches at the edge per image+transform so once a variant
is hot, the WP host doesn't see it again. If the WP host is on a
managed service with rate limits, watch the origin egress for the
first 24h after cutover.*

### A4. Enable Image Resizing

Cloudflare dashboard → your zone → **Speed → Optimization → Image
Resizing** → Enable. This is the paid feature. Pricing as of late 2025:
$5/month flat + $0.50 per 1k transformations. Editorial-site traffic
typically lands at $5–15/month total.

### A5. Test before flipping the frontend

Pick any known image URL. Hit the resized version directly:

```bash
curl -I "https://media.thephotographicjournal.com/cdn-cgi/image/width=800,quality=85,format=auto/wp-content/uploads/2020/01/SOME-KNOWN-IMAGE.jpg"
```

Expect: `200 OK`, `content-type: image/webp` (or `image/avif` on
modern UAs), `cf-resized: ...` header present.

If you get a 404, the CNAME target is wrong — the path after
`/cdn-cgi/image/<params>/` must exist on the origin Cloudflare is
proxying. Try the target URL directly first to confirm the underlying
image is reachable.

### A6. Flip the env var

Vercel → tpj-2026 project → Settings → Environment Variables. Add:

- Key: `NEXT_PUBLIC_CDN_BASE`
- Value: `https://media.thephotographicjournal.com`
- Apply to: Production, Preview, Development (all three).

Trigger a deploy (push any change or hit "Redeploy" on the latest).

### A7. Validate

On a deployed article page:

- View source. Find a `<TpjImage>`-rendered image (e.g. the hero).
  Confirm `srcset` is present and entries point at
  `media.thephotographicjournal.com/cdn-cgi/image/width=…`.
- Find an article-body image (inside the prose). Same check — the
  HTML rewriter should have injected `srcset` + `sizes` + `loading="lazy"`.
- DevTools → Network → reload, look at any image request. `content-type`
  should be `image/webp` on Chrome/Edge, `image/avif` on Safari.
- Lighthouse / PageSpeed: rerun against an article page. LCP should
  drop noticeably; "Properly size images" + "Serve images in
  next-gen formats" warnings should clear.

### A8. (Optional) Local dev parity

Add to your `frontend/.env.local`:

```
NEXT_PUBLIC_CDN_BASE=https://media.thephotographicjournal.com
```

Restart `npm run dev`. Local now mirrors production CDN behaviour.

### A9. Phase A rollback

If anything is wrong: in Vercel, **remove** `NEXT_PUBLIC_CDN_BASE` and
redeploy. Frontend reverts to plain origin URLs immediately. No data
changed; this is just a config flip.

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
