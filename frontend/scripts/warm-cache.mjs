#!/usr/bin/env node
/**
 * Visit every page in the sitemap once, so no reader is the first
 * visitor after a deploy (a first visit waits 1-8 s on WordPress; later
 * ones come from Vercel's cache in ~0.1 s).
 *
 *   node scripts/warm-cache.mjs [base-url] [concurrency]
 *   node scripts/warm-cache.mjs https://v2.thephotographicjournal.com 2
 *
 * Two at a time by default: the CMS is a 1-CPU, 1 GB server.
 */
const base = (process.argv[2] ?? "https://v2.thephotographicjournal.com").replace(/\/$/, "");
const concurrency = Number(process.argv[3] ?? 2);

const xml = await (await fetch(`${base}/sitemap.xml`)).text();
const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
console.log(`${paths.length} pages, ${concurrency} at a time`);

const stats = { HIT: 0, STALE: 0, MISS: 0, other: 0, failed: 0 };
const slow = [];
let next = 0;
const started = Date.now();

async function worker() {
  while (next < paths.length) {
    const path = paths[next++];
    const t = Date.now();
    try {
      const res = await fetch(base + path, { headers: { "user-agent": "tpj-cache-warmer" } });
      await res.arrayBuffer();
      const cache = res.headers.get("x-vercel-cache") ?? "other";
      stats[cache in stats ? cache : "other"]++;
      if (!res.ok) stats.failed++;
      const ms = Date.now() - t;
      if (ms > 3000) slow.push(`${ms}ms ${path}`);
    } catch {
      stats.failed++;
    }
    if (next % 100 === 0) console.log(`  ${next}/${paths.length}`);
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`done in ${Math.round((Date.now() - started) / 1000)}s`, stats);
if (slow.length) console.log("slowest:\n  " + slow.sort().reverse().slice(0, 10).join("\n  "));
