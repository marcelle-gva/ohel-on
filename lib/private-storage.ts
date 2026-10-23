import type { SupabaseClient } from "@supabase/supabase-js";

type PrivateBucket = "documentos" | "comprovantes";

export async function uploadChurchFile(
  client: SupabaseClient,
  bucket: PrivateBucket,
  churchId: string,
  file: File,
  fileName: string,
): Promise<string> {
  if (!churchId) throw new Error("Igreja não identificada.");

  const path = `${churchId}/${fileName}`;
  const { error } = await client.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return path;
}

export async function getPrivateFileUrl(
  client: SupabaseClient,
  bucket: PrivateBucket,
  storedValue: string,
): Promise<string> {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = storedValue.indexOf(marker);
  const encodedPath = markerIndex >= 0
    ? storedValue.slice(markerIndex + marker.length).split("?")[0]
    : storedValue;
  const path = encodedPath.split("/").map(segment => decodeURIComponent(segment)).join("/");
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 15 * 60);
  if (error) throw error;
  return data.signedUrl;
}
