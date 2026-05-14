import { gql } from "graphql-request";
import { wpClient } from "../api";

/**
 * Per-theme article counts (essay + interview + feature combined).
 * Powers the "N essays" label on the themes index and any other
 * surface that needs a quick collection-size cue. Reads from the
 * custom `articleCount` field on the `Theme` GraphQL type — see
 * inc/graphql.php.
 */
const ThemeCountsQuery = gql`
  query ThemeCounts {
    themes(first: 100) {
      nodes {
        slug
        articleCount
      }
    }
  }
`;

type Response = {
  themes: { nodes: { slug: string | null; articleCount: number | null }[] };
};

export async function fetchThemeCounts(): Promise<Record<string, number>> {
  const data = await wpClient.request<Response>(ThemeCountsQuery);
  const out: Record<string, number> = {};
  for (const node of data.themes.nodes) {
    if (node.slug) out[node.slug] = node.articleCount ?? 0;
  }
  return out;
}
