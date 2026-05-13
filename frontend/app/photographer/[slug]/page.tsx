import { notFound } from "next/navigation";
import { PhotographerProfileBody } from "@/components/PhotographerProfileBody";
import { fetchPhotographerArticles } from "@/lib/queries/photographer-articles";
import { fetchPhotographerBySlug } from "@/lib/queries/photographer-by-slug";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PhotographerPage({ params }: Props) {
  const { slug } = await params;

  const [photographer, articles] = await Promise.all([
    fetchPhotographerBySlug(slug),
    fetchPhotographerArticles(slug),
  ]);

  if (!photographer) notFound();

  return (
    <PhotographerProfileBody photographer={photographer} articles={articles} />
  );
}
