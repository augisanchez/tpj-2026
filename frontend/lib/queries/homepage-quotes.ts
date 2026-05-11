import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { decodeHtmlEntities } from "../text-utils";
import type { InterviewQuote } from "@/components/InterviewQuoteRotator";

const HomepageQuotesQuery = gql`
  query HomepageQuotes($first: Int = 12) {
    interviews(
      first: $first
      where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
        id
        title
        slug
        content
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
      }
    }
  }
`;

type Raw = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
};

type Response = { interviews: { nodes: Raw[] } };

/**
 * Pull a quotable paragraph from interview body HTML. Headings (h1-h6)
 * carry the interviewer's questions and are deliberately skipped — we
 * only sample <p> content, which is the subject's spoken response. We
 * also bound length so the quote fits a single editorial moment.
 */
function pickParagraphQuote(html: string | null): string | null {
  if (!html) return null;
  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) =>
      decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((t) => t.length >= 80 && t.length <= 320);
  if (paragraphs.length === 0) return null;
  return paragraphs[Math.floor(Math.random() * paragraphs.length)];
}

export async function fetchHomepageQuotes(
  first = 12
): Promise<InterviewQuote[]> {
  const data = await wpClient.request<Response>(HomepageQuotesQuery, {
    first,
  });
  return data.interviews.nodes
    .map((node): InterviewQuote | null => {
      const quote = pickParagraphQuote(node.content);
      if (!quote) return null;
      const fi = node.featuredImage?.node;
      const src = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
      const title = decodeHtmlEntities(node.title);
      return {
        id: node.id,
        slug: node.slug,
        attribution: title,
        quote,
        image: src ? { src, alt: fi?.altText || title } : null,
      };
    })
    .filter((q): q is InterviewQuote => q !== null);
}
