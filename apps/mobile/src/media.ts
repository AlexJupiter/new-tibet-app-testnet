import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { validateMedia, type Evidence } from "./evidence";
export async function pickEvidence(kind: string): Promise<Evidence | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error("Allow photo library access to choose your evidence.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === "video" ? ["videos"] : ["images"],
    quality: 0.75,
    videoMaxDuration: 30,
    base64: kind !== "video",
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const mime = asset.base64
    ? "image/jpeg"
    : asset.mimeType || (kind === "video" ? "video/mp4" : "image/jpeg");
  validateMedia(
    kind,
    asset.fileSize ?? 0,
    mime,
    asset.duration == null ? undefined : asset.duration / 1000,
  );
  const base64 = asset.base64 ?? (await new File(asset.uri).base64());
  return { kind, mime, base64, uri: asset.uri };
}
export function releaseEvidence(_files: Evidence[]) {
  /* Native library URIs are managed by the operating system. */
}
