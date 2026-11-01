import { supabase } from "@/lib/supabase";

/**
 * Gera uma URL temporária para um arquivo em bucket privado.
 * O caminho do arquivo continua protegido; somente a URL assinada é exposta.
 */
export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  expiresIn = 60 * 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Não foi possível gerar o link temporário do arquivo.");
  }

  return data.signedUrl;
}
