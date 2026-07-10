/** Client helper: upload an image and return its public URL. */
export async function uploadAsset(file: File, kind: "photo" | "logo"): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch("/api/admin/assets/upload", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "Upload failed");
  return body.url;
}
