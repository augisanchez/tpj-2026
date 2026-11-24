import { pageMetadata } from "@/lib/seo";
import { SearchPage } from "@/components/SearchPage";
import { fetchSearchResults } from "@/lib/queries/search";

export const metadata = pageMetadata({
  title: "Search — The Photographic Journal",
  path: "/search",
});

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchRoute({ searchParams }: Props) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const { photographers, items } = term
    ? await fetchSearchResults(term)
    : { photographers: [], items: [] };

  return <SearchPage initialTerm={term} results={items} photographers={photographers} />;
}
