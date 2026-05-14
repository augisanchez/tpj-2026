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

### A1. Reality check: how does media flow today?

Open the WP admin and find the S3 plugin (likely **WP Offload Media** or
**W3 Total Cache → CDN tab**). Note:

- The **public URL pattern** for media. One of:
  - `https://thephotographicjournal.com/wp-content/uploads/...` (WP serving
    + Apache/Nginx proxy → S3 on the backend), or
  - `https://<bucket>.s3.amazonaws.com/...` (direct S3), or
  - `https://<id>.cloudfront.net/...` (CloudFront in front of S3).
- The **bucket name + region**.
- Whether **CloudFront is already in front of S3**. If yes, we're
  replacing CloudFront with Cloudflare; both can't co-exist.

This determines the CNAME target in A3.

### A2. Cloudflare zone

If `thephotographicjournal.com` isn't on Cloudflare nameservers yet:
add it (Free plan is fine to start), copy the two NS records they give
you, update them at your registrar. DNS propagation 5min–24hr.

If it's already on Cloudflare, skip.

### A3. DNS — add `media` subdomain

In Cloudflare → DNS → Records → Add:

- Type: `CNAME`
- Name: `media`
- Target: whatever serves images today (the bucket URL from A1, or the
  CloudFront distribution, or the apex domain — pick the most direct).
- Proxy status: **Proxied (orange cloud)**. Critical — without this
  Cloudflare can't transform images.

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

Whatever currently writes to S3 (WP Offload Media etc.) — point it at
R2's S3-compatible endpoint:

- Endpoint URL: `https://<your-cf-account-id>.r2.cloudflarestorage.com`
- Access key / secret: R2 API token (create one in R2 settings)
- Bucket: `tpj-media`
- Region: `auto`

Upload one test image through WP admin. Verify it lands in R2 (check
bucket contents in CF dashboard).

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

## What I'd verify against the WP plugin reality before Phase A

The article-body HTML rewriter (`rewriteArticleBodyImages` in
`lib/media.ts`) assumes the `<img src>` values in WP-rendered HTML
match one of the URL shapes `cdnImageUrl` accepts. After URL
canonicalisation those will all be
`https://thephotographicjournal.com/wp-content/uploads/...`.

If your S3 plugin rewrites the in-content URLs to point directly at
S3 or CloudFront (e.g. `s3-bucket.s3.amazonaws.com` or
`d123.cloudfront.net`), the rewriter won't recognise them and will
fall through to the original URL — they'll work but won't get the
CDN treatment. Two fixes if that's the case:

1. Configure the WP plugin to keep `wp-content/uploads/...` URLs in
   post HTML (most plugins have a "rewrite URLs in content" toggle —
   turn it OFF). Cloudflare will pull from S3 via the CNAME.
2. Or, expand `rewriteMediaUrl` in `lib/media.ts` with another branch
   for the actual URL prefix in your DB.

Open a published article in WP admin, switch to Code view, look at
an `<img src>`. That tells you which shape you're dealing with.

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
