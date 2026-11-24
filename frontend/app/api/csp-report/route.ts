/**
 * Receives Content-Security-Policy violation reports (report-only for
 * now). Logged to Vercel's function logs, tagged "csp-report", so the
 * policy can be tightened and enforced once real traffic is clean.
 */
export async function POST(request: Request) {
  try {
    const text = (await request.text()).slice(0, 4000);
    console.log("csp-report", text);
  } catch {
    // Ignore malformed reports.
  }
  return new Response(null, { status: 204 });
}
