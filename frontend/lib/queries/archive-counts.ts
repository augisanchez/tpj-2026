import { gql } from "graphql-request";
import { wpClient } from "../api";

/**
 * Published totals per article type plus photographer profiles.
 * Powers the counts on the homepage (View all N, archive mosaic).
 * Reads the custom `tpjCounts` root field — see inc/graphql.php.
 */
const ArchiveCountsQuery = gql`
  query ArchiveCounts {
    tpjCounts {
      essays
      interviews
      features
      photographers
    }
  }
`;

export type ArchiveCounts = {
  essays: number;
  interviews: number;
  features: number;
  photographers: number;
  articles: number;
};

type Response = {
  tpjCounts: Partial<Record<keyof Omit<ArchiveCounts, "articles">, number | null>> | null;
};

export async function fetchArchiveCounts(): Promise<ArchiveCounts | null> {
  try {
    const data = await wpClient.request<Response>(ArchiveCountsQuery);
    const c = data.tpjCounts;
    if (!c) return null;
    const essays = c.essays ?? 0;
    const interviews = c.interviews ?? 0;
    const features = c.features ?? 0;
    return {
      essays,
      interviews,
      features,
      photographers: c.photographers ?? 0,
      articles: essays + interviews + features,
    };
  } catch {
    // Older CMS without the field: hide counts rather than break the page.
    return null;
  }
}
