import { fetchRecentEssays, type RecentEssay } from "./recent-essays";
import { fetchRecentFeatures } from "./recent-features";
import { fetchRecentInterviews } from "./recent-interviews";

export type RecentArticleContentType = "essay" | "feature" | "interview";

export type RecentArticle = RecentEssay & {
  contentType: RecentArticleContentType;
};

const TYPE_TO_PATH: Record<RecentArticleContentType, string> = {
  essay: "/essay",
  feature: "/feature",
  interview: "/interview",
};

const TYPE_TO_LABEL: Record<RecentArticleContentType, string> = {
  essay: "Photo Essay",
  feature: "Feature",
  interview: "Interview",
};

export function articleHref(article: RecentArticle): string {
  return `${TYPE_TO_PATH[article.contentType]}/${article.slug}`;
}

export function articleLabel(article: RecentArticle): string {
  return TYPE_TO_LABEL[article.contentType];
}

export async function fetchRecentArticles(
  first = 15
): Promise<RecentArticle[]> {
  const [essays, features, interviews] = await Promise.all([
    fetchRecentEssays(first),
    fetchRecentFeatures(first),
    fetchRecentInterviews(first),
  ]);

  const merged: RecentArticle[] = [
    ...essays.map((e) => ({ ...e, contentType: "essay" as const })),
    ...features.map((f) => ({ ...f, contentType: "feature" as const })),
    ...interviews.map((i) => ({ ...i, contentType: "interview" as const })),
  ];

  merged.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return merged.slice(0, first);
}
