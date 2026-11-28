import { pageMetadata } from "@/lib/seo";
import { SearchPage } from "@/components/SearchPage";

export const metadata = pageMetadata({
  title: "Search — The Photographic Journal",
  path: "/search",
});

type Props = {
  searchParams: Promise<{ q?: string }>;
};

// No WordPress call here: titles and names come from the in-browser
// index, and words inside stories load from /api/search once the page is
// up. The page itself answers in milliseconds.
export default async function SearchRoute({ searchParams }: Props) {
  const { q } = await searchParams;
  return <SearchPage initialTerm={(q ?? "").trim()} />;
}
