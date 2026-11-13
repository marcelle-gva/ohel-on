import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  detectarMimeImagem,
  MAX_SORTEIO_IMAGE_BYTES,
  SORTEIOS_STORAGE_BUCKET,
  type ImagemMime,
  validarImagemRecebida,
} from "@/lib/sorteios-admin";

export type SorteioOwnership = {
  id: string;
  igreja_id: string;
  nome: string;
  descricao: string | null;
  cartaz_url: string | null;
};

export function criarClienteComSessao(request: Request): SupabaseClient {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token) throw erroDeServico(401, "Sessão administrativa ausente ou expirada.");
  if (!url || !anonKey) throw erroDeServico(503, "Cliente Supabase de sessão não está configurado.");
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function buscarSorteioDaIgreja(
  service: SupabaseClient,
  igrejaId: string,
  sorteioId: string,
): Promise<{ data: SorteioOwnership | null; error: unknown }> {
  const result = await service
    .from("sorteios")
    .select("id, igreja_id, nome, descricao, cartaz_url")
    .eq("id", sorteioId)
    .eq("igreja_id", igrejaId)
    .maybeSingle();
  return { data: result.data as SorteioOwnership | null, error: result.error };
}

export function erroDeServico(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

export async function lerRespostaDeServico(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // O serviço pode retornar texto puro; nesse caso o trecho abaixo é a mensagem útil.
  }
  return body.slice(0, 500) || `Serviço retornou HTTP ${response.status}.`;
}

export async function chamarImageService(
  path: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const baseUrl = process.env.MANUS_API_URL?.trim();
  const apiKey = process.env.MANUS_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    throw erroDeServico(
      503,
      "Geração IA indisponível: MANUS_API_URL e MANUS_API_KEY precisam estar configuradas no servidor.",
    );
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "connect-protocol-version": "1",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    throw erroDeServico(response.status === 429 ? 429 : 502, await lerRespostaDeServico(response));
  }
  const parsed = (await response.json()) as Record<string, unknown>;
  if (parsed.error) {
    throw erroDeServico(502, typeof parsed.error === "string" ? parsed.error : "O ImageService retornou um erro.");
  }
  return parsed;
}

function asImageRecord(value: unknown): { url?: string; b64Json?: string; mimeType?: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    url: typeof record.url === "string" ? record.url : undefined,
    b64Json: typeof record.b64Json === "string" ? record.b64Json : undefined,
    mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
  };
}

export async function obterBytesDeImagemGerada(
  result: Record<string, unknown>,
): Promise<{ bytes: Buffer; mime: ImagemMime }> {
  const image = asImageRecord(result.image);
  if (!image) throw erroDeServico(502, "O ImageService não retornou uma imagem válida.");

  let bytes: Buffer;
  let declaredMime = image.mimeType || "";
  if (image.b64Json) {
    try {
      bytes = Buffer.from(image.b64Json, "base64");
    } catch {
      throw erroDeServico(502, "A imagem gerada retornou base64 inválido.");
    }
  } else if (image.url) {
    const response = await fetch(image.url, { cache: "no-store" });
    if (!response.ok) throw erroDeServico(502, "Não foi possível baixar a imagem gerada para o Storage.");
    declaredMime = response.headers.get("content-type")?.split(";", 1)[0] || declaredMime;
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    throw erroDeServico(502, "O ImageService não retornou URL ou conteúdo de imagem.");
  }

  if (bytes.byteLength > MAX_SORTEIO_IMAGE_BYTES) {
    throw erroDeServico(502, "A imagem gerada excede o limite de 8 MB.");
  }
  const validation = validarImagemRecebida(bytes, declaredMime);
  if ("error" in validation) throw erroDeServico(502, validation.error);
  const actual = detectarMimeImagem(bytes);
  if (!actual) throw erroDeServico(502, "A imagem gerada não passou na validação de conteúdo.");
  return { bytes, mime: actual };
}

function extensaoParaMime(mime: ImagemMime): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function urlPublicaDoStorage(service: SupabaseClient, path: string): string {
  const publicUrl = service.storage.from(SORTEIOS_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  if (!publicUrl) throw erroDeServico(503, "O bucket autorizado não retornou uma URL pública para a foto.");
  return publicUrl;
}

export async function persistirFotoDoSorteio(
  service: SupabaseClient,
  sorteio: Pick<SorteioOwnership, "id" | "igreja_id">,
  bytes: Buffer,
  mime: ImagemMime,
): Promise<{ cartazUrl: string }> {
  const path = `sorteios/${sorteio.igreja_id}/${sorteio.id}/${crypto.randomUUID()}.${extensaoParaMime(mime)}`;
  const upload = await service.storage.from(SORTEIOS_STORAGE_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (upload.error) throw erroDeServico(502, "Não foi possível salvar a foto no Storage autorizado.");

  const cartazUrl = urlPublicaDoStorage(service, path);
  const update = await service
    .from("sorteios")
    .update({ cartaz_url: cartazUrl })
    .eq("id", sorteio.id)
    .eq("igreja_id", sorteio.igreja_id)
    .select("id, cartaz_url")
    .maybeSingle();
  if (update.error || !update.data) {
    await service.storage.from(SORTEIOS_STORAGE_BUCKET).remove([path]);
    throw erroDeServico(503, "A foto foi recebida, mas não foi possível atualizar o sorteio; a foto anterior foi preservada.");
  }
  return { cartazUrl };
}
