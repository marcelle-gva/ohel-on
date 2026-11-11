"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Briefcase,
  CalendarCheck,
  Camera,
  Heart,
  Loader2,
  MapPin,
  Save,
  UserRound,
} from "lucide-react";

interface MembroPerfil {
  id: string;
  nome: string;
  email: string | null;
  status: string;
  foto_url: string | null;
  cargo: string | null;
  departamento: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  estado_civil: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  whatsapp_opt_in: boolean;
}

type FormPerfil = { [K in keyof Omit<MembroPerfil, "id" | "email" | "status" | "foto_url" | "cargo" | "departamento">]: NonNullable<MembroPerfil[K]> };
type PerfilResponse = { membro?: MembroPerfil; error?: string };

const vazio: FormPerfil = {
  nome: "",
  data_nascimento: "",
  sexo: "",
  estado_civil: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "",
  whatsapp_opt_in: false,
};

const paraFormulario = (membro: MembroPerfil): FormPerfil => ({
  nome: membro.nome || "",
  data_nascimento: membro.data_nascimento || "",
  sexo: membro.sexo || "",
  estado_civil: membro.estado_civil || "",
  telefone: membro.telefone || "",
  cep: membro.cep || "",
  logradouro: membro.logradouro || "",
  numero: membro.numero || "",
  bairro: membro.bairro || "",
  cidade: membro.cidade || "",
  uf: membro.uf || "",
  whatsapp_opt_in: membro.whatsapp_opt_in === true,
});

async function lerResposta(response: Response): Promise<PerfilResponse> {
  try {
    return await response.json() as PerfilResponse;
  } catch {
    return {};
  }
}

export default function PerfilMembroPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [membro, setMembro] = useState<MembroPerfil | null>(null);
  const [form, setForm] = useState<FormPerfil>(vazio);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErro("Sua sessão expirou. Redirecionando para o acesso do membro.");
        router.replace("/login-membro");
        return;
      }

      const response = await fetch("/api/membros/meu-perfil", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await lerResposta(response);

      if (!response.ok || !result.membro) {
        setErro(result.error || "Não foi possível carregar seu perfil agora. Tente novamente.");
        return;
      }

      setMembro(result.membro);
      setForm(paraFormulario(result.membro));
      setErro("");
    } catch {
      setErro("Não foi possível carregar seu perfil agora. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregar(); }, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const alterar = (campo: keyof FormPerfil, valor: string | boolean) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const salvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSalvando(true);
    setMensagem("");
    setErro("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login-membro");
        return;
      }

      const response = await fetch("/api/membros/meu-perfil", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const result = await lerResposta(response);

      if (!response.ok || !result.membro) {
        setErro(result.error || "Não foi possível salvar seu perfil.");
        return;
      }

      setMembro(result.membro);
      setMensagem("Perfil atualizado com sucesso.");
      window.dispatchEvent(new Event("ohel:perfil-atualizado"));
    } catch {
      setErro("Não foi possível salvar seu perfil agora. Seus dados anteriores foram preservados.");
    } finally {
      setSalvando(false);
    }
  };

  const trocarFoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setMensagem("");
    setErro("");

    if (!file.type.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem válido.");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErro("A foto deve ter no máximo 5 MB.");
      input.value = "";
      return;
    }

    setEnviandoFoto(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login-membro");
        return;
      }

      const body = new FormData();
      body.append("foto", file);
      const response = await fetch("/api/membros/meu-perfil", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });
      const result = await lerResposta(response);

      if (!response.ok || !result.membro) {
        setErro(result.error || "Não foi possível atualizar sua foto.");
        return;
      }

      setMembro((atual) => atual ? { ...atual, foto_url: result.membro?.foto_url || null } : atual);
      setMensagem("Foto atualizada com sucesso.");
      window.dispatchEvent(new Event("ohel:perfil-atualizado"));
    } catch {
      setErro("Não foi possível atualizar sua foto agora. A foto anterior foi preservada.");
    } finally {
      setEnviandoFoto(false);
      input.value = "";
    }
  };

  if (loading) {
    return (
      <section className="flex items-center justify-center py-16 text-gray-300" aria-live="polite">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando seu perfil...
      </section>
    );
  }

  if (erro && !membro) {
    return (
      <section className="mx-auto w-full max-w-md py-8">
        <Card className="text-center">
          <p className="text-sm text-red-200" role="alert">{erro}</p>
          <Link href="/login-membro" className="mt-4 inline-block text-sm text-ohel-blue hover:underline">
            Voltar ao acesso do membro
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-4xl pb-4">
      <div className="mb-6 space-y-3">
        <Link href="/area-membro" className="inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao meu dashboard
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Área do Membro</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Meu perfil</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">Mantenha seus dados atualizados para facilitar o contato da igreja.</p>
        </div>
      </div>

      {(mensagem || erro) && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${erro ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}
          role={erro ? "alert" : "status"}
        >
          {erro || mensagem}
        </div>
      )}

      <Card className="mb-5 border-gray-800 p-5 sm:p-8">
        <form onSubmit={salvar} className="space-y-6">
          <div className="flex flex-col gap-5 border-b border-gray-800 pb-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-ohel-bg">
              {membro?.foto_url ? (
                // A URL da foto vem do storage e pode usar um domínio configurado fora do Next Image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={membro.foto_url} alt={`Foto de ${membro.nome}`} className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-9 w-9 text-gray-600" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-white">Dados pessoais</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">Atualize seus dados e sua foto. O e-mail de acesso não pode ser alterado por aqui.</p>
              <label htmlFor="perfil-foto" className="sr-only">Selecionar foto de perfil</label>
              <input
                ref={fileInputRef}
                id="perfil-foto"
                type="file"
                accept="image/*"
                onChange={trocarFoto}
                className="sr-only"
                aria-describedby="perfil-foto-ajuda"
              />
              <Button
                type="button"
                variant="secondary"
                className="mt-3 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={enviandoFoto}
                aria-controls="perfil-foto"
              >
                <Camera className="h-4 w-4" />
                {enviandoFoto ? "Enviando..." : "Trocar foto"}
              </Button>
              <p id="perfil-foto-ajuda" className="mt-2 text-xs text-gray-500">Imagem JPG, PNG ou similar, com até 5 MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="field-label">Nome completo</span>
              <input required value={form.nome} onChange={(event) => alterar("nome", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" />
            </label>
            <label>
              <span className="field-label">Data de nascimento</span>
              <input type="date" value={form.data_nascimento} onChange={(event) => alterar("data_nascimento", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" />
            </label>
            <label>
              <span className="field-label">Telefone / WhatsApp</span>
              <input value={form.telefone} onChange={(event) => alterar("telefone", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" />
            </label>
            <label>
              <span className="field-label">Sexo</span>
              <select value={form.sexo} onChange={(event) => alterar("sexo", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm">
                <option value="">Selecione...</option>
                <option>Masculino</option>
                <option>Feminino</option>
              </select>
            </label>
            <label>
              <span className="field-label">Estado civil</span>
              <select value={form.estado_civil} onChange={(event) => alterar("estado_civil", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm">
                <option value="">Selecione...</option>
                <option>Solteiro(a)</option>
                <option>Casado(a)</option>
                <option>Divorciado(a)</option>
                <option>Viúvo(a)</option>
              </select>
            </label>
          </div>

          <div className="border-t border-gray-800 pt-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <MapPin className="h-4 w-4 text-ohel-blue" aria-hidden="true" />
              Endereço
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <label>
                <span className="field-label">CEP</span>
                <input value={form.cep} onChange={(event) => alterar("cep", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-3">
                <span className="field-label">Logradouro</span>
                <input value={form.logradouro} onChange={(event) => alterar("logradouro", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" />
              </label>
              <label>
                <span className="field-label">Número</span>
                <input value={form.numero} onChange={(event) => alterar("numero", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2">
                <span className="field-label">Bairro</span>
                <input value={form.bairro} onChange={(event) => alterar("bairro", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" />
              </label>
              <label>
                <span className="field-label">Cidade</span>
                <input value={form.cidade} onChange={(event) => alterar("cidade", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" />
              </label>
              <label>
                <span className="field-label">UF</span>
                <input maxLength={2} value={form.uf} onChange={(event) => alterar("uf", event.target.value.toUpperCase())} className="input-ohel w-full rounded-lg px-4 py-3 text-sm uppercase" />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-ohel-bg p-3">
            <label className="flex items-start gap-3 text-xs text-gray-300">
              <input type="checkbox" checked={form.whatsapp_opt_in} onChange={(event) => alterar("whatsapp_opt_in", event.target.checked)} className="mt-0.5 accent-emerald-500" />
              <span>Autorizo receber comunicações da igreja pelo WhatsApp.</span>
            </label>
          </div>

          <Button type="submit" disabled={salvando || enviandoFoto} className="w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {salvando ? "Salvando..." : "Salvar perfil"}
          </Button>
        </form>
      </Card>

      <Card className="mb-5 border-gray-800 p-5 sm:p-8">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
          <Briefcase className="h-4 w-4 text-ohel-blue" aria-hidden="true" />
          Vínculo na igreja
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-800 bg-ohel-bg p-4">
            <p className="field-label">Cargo</p>
            <p className="text-sm text-gray-200">{membro?.cargo || "Não informado"}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-ohel-bg p-4">
            <p className="field-label">Departamento</p>
            <p className="text-sm text-gray-200">{membro?.departamento || "Não informado"}</p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-gray-500">Alterações de vínculo e permissões são realizadas pela secretaria.</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-gray-800 p-5 sm:p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-ohel-blue/10">
            <CalendarCheck className="h-5 w-5 text-ohel-blue" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-white">Check-in</h2>
          <p className="mt-2 text-xs text-gray-400">Faça seu check-in quando houver um evento disponível.</p>
          <Link href="/checkin" className="mt-4 block">
            <Button variant="primary" className="w-full text-xs">Abrir Check-in</Button>
          </Link>
        </Card>
        <Card className="border-gray-800 p-5 sm:p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <Heart className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-white">Cestas básicas</h2>
          <p className="mt-2 text-xs text-gray-400">Veja o que está faltando e marque os itens que você pode doar.</p>
          <Link href="/area-membro/cestas" className="mt-4 block">
            <Button variant="secondary" className="w-full text-xs">Ver itens faltantes</Button>
          </Link>
        </Card>
      </div>

      <style jsx>{`.field-label{display:block;color:#a1a1aa;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem}`}</style>
    </section>
  );
}
