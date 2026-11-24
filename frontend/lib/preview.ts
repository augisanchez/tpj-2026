import { draftMode } from "next/headers";

/**
 * Draft preview target, read from a `preview-<id>` slug (or
 * `preview-<id>-p` for unsaved changes to a published post). Only
 * honoured while Next.js draft mode is on, which /api/preview turns on
 * after checking the signed link WordPress generates.
 */
export type PreviewTarget = { id: number; asPreview: boolean };

export async function previewTarget(slug: string): Promise<PreviewTarget | undefined> {
  const m = /^preview-(\d+)(-p)?$/.exec(slug);
  if (!m) return undefined;
  const { isEnabled } = await draftMode();
  if (!isEnabled) return undefined;
  return { id: Number(m[1]), asPreview: Boolean(m[2]) };
}
