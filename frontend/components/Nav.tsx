import { fetchStoryIndex } from "@/lib/queries/story-index";
import type { DrawerPhotographer } from "./MobileDrawer";
import { NavClient } from "./NavClient";

const RECENT_COUNT = 5;

/**
 * The five photographers behind the newest stories, for the menu's
 * "Recently published" list. Read from the story index, which is
 * already cached for an hour and shared with /index and /random, so
 * this adds no CMS requests. Only credits linked to a profile count.
 */
async function recentPhotographers(): Promise<DrawerPhotographer[]> {
  const stories = await fetchStoryIndex().catch(() => []);
  const out: DrawerPhotographer[] = [];
  const seen = new Set<string>();
  for (const s of stories) {
    if (!s.photographer || !s.photographerSlug || seen.has(s.photographerSlug)) continue;
    seen.add(s.photographerSlug);
    out.push({ name: s.photographer, slug: s.photographerSlug });
    if (out.length === RECENT_COUNT) break;
  }
  return out;
}

/** Site header. Server half: fetches the menu's recent photographers. */
export async function Nav() {
  return <NavClient recent={await recentPhotographers()} />;
}
