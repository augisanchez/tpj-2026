import { SearchPage } from "@/components/SearchPage";
import { fetchSearchResults } from "@/lib/queries/search";

export const metadata = {
  title: "Search — The Photographic Journal",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchRoute({ searchParams }: Props) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const results = term ? await fetchSearchResults(term) : [];

  return <SearchPage initialTerm={term} results={results} />;
}
