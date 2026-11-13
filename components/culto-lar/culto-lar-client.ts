import { supabase } from "@/lib/supabase";

export const CULTOLAR_ACCESS_LOST = "ohel:culto-lar-access-lost";

export class CultoLarClientError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function cultoLarRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (init.signal?.aborted) throw new DOMException("Solicitação cancelada", "AbortError");
  if (!session?.access_token) {
    window.dispatchEvent(new Event(CULTOLAR_ACCESS_LOST));
    throw new CultoLarClientError("Sua sessão expirou. Entre novamente.", 401);
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  if ([401, 403].includes(response.status)) window.dispatchEvent(new Event(CULTOLAR_ACCESS_LOST));
  return response;
}

export async function cultoLarJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await cultoLarRequest(path, init);
  let value: (T & { error?: string }) | null = null;
  try { value = await response.json(); } catch { /* Erro seguro também quando a resposta não é JSON. */ }
  if (!response.ok || !value) throw new CultoLarClientError(value?.error || "Não foi possível concluir. Tente novamente.", response.status);
  return value;
}
