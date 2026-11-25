import { indexCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt = "Themes · The Photographic Journal";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return indexCard("Themes", "Eleven themes that thread through the archive.");
}
