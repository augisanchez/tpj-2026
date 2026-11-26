import { headers } from "next/headers";
import { SITE_URL } from "@/lib/seo";

/** The public domain. Every other host (v2., previews) stays out of search. */
const PUBLIC_HOST = /^(www\.)?thephotographicjournal\.com$/i;

/**
 * Crawlers that collect pages to train AI models. Each company says its
 * crawler obeys robots.txt; blocking these doesn't touch search ranking.
 * Google-Extended and Applebot-Extended are training-only tokens: Google
 * Search and Apple's Siri/Spotlight results keep crawling as before.
 *
 * Deliberately NOT listed: the tools that fetch a page to answer a
 * person's question and link back (OAI-SearchBot, ChatGPT-User,
 * Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User).
 * Blocking those would drop TPJ from AI search answers.
 */
const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "FacebookBot",
  "Bytespider",
  "Amazonbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "AI2Bot",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "Timpibot",
];

export async function GET() {
  const host = ((await headers()).get("host") ?? "").split(":")[0];
  // Staging: crawlers may fetch pages so they see the X-Robots-Tag
  // noindex header (next.config.ts); a Disallow would hide it.
  const body = PUBLIC_HOST.test(host)
    ? [
        "# Search and AI search answers that link back: welcome.",
        "# Training AI models on this site's photographs and writing: not permitted.",
        "# This is an express reservation of rights under Article 4 of",
        "# EU Directive 2019/790 (text and data mining).",
        "",
        "User-agent: *",
        "Content-Signal: search=yes, ai-input=yes, ai-train=no",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /search",
        "",
        ...AI_TRAINING_CRAWLERS.map((ua) => `User-agent: ${ua}`),
        "Disallow: /",
        "",
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        "",
      ].join("\n")
    : "User-agent: *\nAllow: /\n";
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
