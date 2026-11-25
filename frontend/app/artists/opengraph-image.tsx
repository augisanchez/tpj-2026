import { indexCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt = "Artists · The Photographic Journal";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return indexCard("Artists", "Photographers, writers and interviewers, A to Z.");
}
