/**
 * Which commit this deployment was built from. The cache warm-up
 * workflow (.github/workflows/warm-cache.yml) waits for this to match
 * the pushed commit before visiting every page.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
