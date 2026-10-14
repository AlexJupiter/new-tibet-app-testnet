export type Evidence = {
  kind: string;
  mime: string;
  base64: string;
  uri: string;
};
export const EVIDENCE_KINDS = [
  "front",
  "back",
  "identity",
  "challenge",
  "video",
] as const;
export function validateMedia(
  kind: string,
  size: number,
  mime: string,
  duration?: number,
) {
  if (!EVIDENCE_KINDS.includes(kind as (typeof EVIDENCE_KINDS)[number]))
    throw new Error("Unknown evidence type.");
  if (size > (kind === "video" ? 10_000_000 : 2_000_000))
    throw new Error("Choose a photo under 2 MB or a video under 10 MB.");
  if (kind === "video") {
    if (!["video/mp4", "video/quicktime"].includes(mime))
      throw new Error("Choose an MP4 or MOV video.");
    if (duration !== undefined && duration > 30)
      throw new Error("Choose a video no longer than 30 seconds.");
  } else if (!["image/jpeg", "image/png"].includes(mime))
    throw new Error("Choose a JPEG or PNG photo.");
}
