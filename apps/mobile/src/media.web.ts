import { validateMedia, type Evidence } from "./evidence";
function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Unable to read this file."));
    reader.readAsDataURL(file);
  });
}
function videoDuration(url: string) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      video.removeAttribute("src");
      video.load();
      resolve(duration);
    };
    video.onerror = () =>
      reject(
        new Error("Unable to read this video. Choose an MP4 or MOV file."),
      );
    video.src = url;
  });
}
export async function pickEvidence(kind: string): Promise<Evidence | null> {
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      kind === "video"
        ? "video/mp4,video/quicktime,.mp4,.mov"
        : "image/jpeg,image/png";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (file: File | null) => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", focused);
      input.remove();
      resolve(file);
    };
    const focused = () => {
      timer = setTimeout(() => finish(input.files?.[0] ?? null), 500);
    };
    input.onchange = () => finish(input.files?.[0] ?? null);
    input.oncancel = () => finish(null);
    window.addEventListener("focus", focused, { once: true });
    input.style.display = "none";
    document.body.appendChild(input);
    input.click();
  });
  if (!file) return null;
  const mime =
    file.type ||
    (/\.mov$/i.test(file.name)
      ? "video/quicktime"
      : /\.mp4$/i.test(file.name)
        ? "video/mp4"
        : "");
  validateMedia(kind, file.size, mime);
  const uri = URL.createObjectURL(file);
  try {
    if (kind === "video")
      validateMedia(kind, file.size, mime, await videoDuration(uri));
    return { kind, mime, base64: await readBase64(file), uri };
  } catch (error) {
    URL.revokeObjectURL(uri);
    throw error;
  }
}
export function releaseEvidence(files: Evidence[]) {
  for (const file of files)
    if (file.uri.startsWith("blob:")) URL.revokeObjectURL(file.uri);
}
