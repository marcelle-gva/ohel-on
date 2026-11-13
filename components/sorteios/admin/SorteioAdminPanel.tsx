"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Phone,
  RefreshCw,
  Save,
  Sparkles,
  Ticket,
  Upload,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export type SorteioAdmin = {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  valor_bilhete: number | string;
  total_numeros: number;
  numero_inicial: number;
  numero_final: number;
  data_sorteio: string | null;
  cartaz_url: string | null;
};

type MembroVendedor = { id: string; nome: string; codigo_membro: string | null; status: string };
type ParticipanteAdmin = {
  id: string;
  numero: number;
  nome: string;
  telefone: string;
  valor: number | string;
  status: string;
  observacoes: string | null;
  origem: "online" | "manual" | string;
  vendedor_membro_id: string | null;
  vendedor_nome: string | null;
  pagamento_manual_status: string;
  pagamento_manual_observacoes: string | null;
};

type ApiPayload = {
  sorteio: SorteioAdmin;
  participantes: ParticipanteAdmin[];
  membros: MembroVendedor[];
};

type FormState = {
  numero: string;
  vendedorMembroId: string;
  nome: string;
  telefone: string;
  observacoes: string;
};

async function apiRequest(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente para gerenciar o sorteio.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as { error?: string; [key: string]: unknown };
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

function statusLabel(status: string) {
  return ({
    pendente: "Pendente",
    reservado: "Reservado",
    confirmado: "Confirmado",
    cancelado: "Cancelado",
  } as Record<string, string>)[status] || status;
}

function origemLabel(origem: string) {
  return origem === "manual" ? "Cadastro manual" : "Venda online";
}

export default function SorteioAdminPanel({ sorteioId }: { sorteioId: string }) {
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [form, setForm] = useState<FormState>({ numero: "", vendedorMembroId: "", nome: "", telefone: "", observacoes: "" });
  const [loading, setLoading] = useState(true);
  const [savingManual, setSavingManual] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sellerSaving, setSellerSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest(`/api/sorteios/admin/${sorteioId}`) as unknown as ApiPayload;
      setPayload(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o sorteio.");
    } finally {
      setLoading(false);
    }
  }, [sorteioId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const occupied = payload?.participantes.length || 0;
  const available = useMemo(() => {
    if (!payload) return 0;
    return Math.max(0, payload.sorteio.total_numeros - occupied);
  }, [occupied, payload]);

  const updateForm = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const cadastrarNumero = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingManual(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/sorteios/admin/${sorteioId}/numeros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ numero: "", vendedorMembroId: "", nome: "", telefone: "", observacoes: "" });
      setNotice("Número cadastrado e marcado como reservado manualmente. Nenhum lançamento financeiro foi criado.");
      await carregar();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível cadastrar o número.");
    } finally {
      setSavingManual(false);
    }
  };

  const enviarFoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const foto = event.target.files?.[0];
    event.target.value = "";
    if (!foto) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.set("foto", foto);
      await apiRequest(`/api/sorteios/admin/${sorteioId}/foto`, { method: "POST", body });
      setNotice("Foto salva no bucket autorizado e vinculada ao sorteio.");
      await carregar();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  const gerarFoto = async () => {
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/sorteios/admin/${sorteioId}/imagem`, { method: "POST" });
      setNotice("Imagem gerada, persistida no Storage e vinculada ao sorteio.");
      await carregar();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "A geração de imagem falhou; a foto anterior foi preservada.");
    } finally {
      setGenerating(false);
    }
  };

  const alterarVendedor = async (participante: ParticipanteAdmin, vendedorMembroId: string) => {
    setSellerSaving(participante.id);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/api/sorteios/admin/${sorteioId}/participantes/${participante.id}/vendedor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedorMembroId: vendedorMembroId || null }),
      }) as { participante?: { vendedor_membro_id: string | null } };
      const nome = payload?.membros.find((membro) => membro.id === vendedorMembroId)?.nome || null;
      setPayload((current) => current ? {
        ...current,
        participantes: current.participantes.map((item) => item.id === participante.id
          ? { ...item, vendedor_membro_id: (result.participante?.vendedor_membro_id ?? vendedorMembroId) || null, vendedor_nome: nome }
          : item),
      } : current);
      setNotice(`Vendedor do número ${participante.numero} atualizado sem alterar a venda ou o status.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o vendedor.");
    } finally {
      setSellerSaving(null);
    }
  };

  if (loading && !payload) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando sorteio...</div>;
  }

  if (!payload) {
    return <div className="mx-auto max-w-xl py-10"><Card className="border-red-500/30 bg-red-500/5"><div className="flex items-start gap-3 text-red-200"><AlertCircle className="mt-0.5 h-5 w-5" /><div><h1 className="font-semibold">Não foi possível abrir o sorteio</h1><p className="mt-1 text-sm text-red-200/80">{error || "Sorteio não encontrado."}</p><button type="button" onClick={() => void carregar()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-100"><RefreshCw className="h-4 w-4" /> Tentar novamente</button></div></div></Card></div>;
  }

  const { sorteio, participantes, membros } = payload;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex items-start gap-3">
          <Link href="/sorteios" className="mt-1 rounded-md p-1 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Voltar para sorteios"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold text-white">{sorteio.nome}</h1><span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase text-violet-300">{sorteio.status}</span></div>
            <p className="mt-1 text-sm text-gray-400">Gestão administrativa dos números e do membro vendedor, sem alterar vendas online.</p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => void carregar()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button>
      </div>

      {(error || notice) && <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}`}>{error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}<span>{error || notice}</span></div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-0 overflow-hidden border-gray-800 bg-ohel-surface">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 p-5">
            <div className="flex items-center gap-3"><Ticket className="h-5 w-5 text-violet-300" /><div><h2 className="font-semibold text-white">Resumo dos números</h2><p className="text-xs text-gray-400">Faixa {sorteio.numero_inicial}–{sorteio.numero_final} · R$ {Number(sorteio.valor_bilhete || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por bilhete</p></div></div>
            <div className="flex gap-3 text-right text-xs"><div><strong className="block text-lg text-white">{occupied}</strong><span className="text-gray-400">ocupados</span></div><div><strong className="block text-lg text-emerald-300">{available}</strong><span className="text-gray-400">disponíveis</span></div></div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[850px] w-full text-left text-sm">
              <thead className="bg-ohel-bg/60 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Número</th><th className="px-5 py-3">Comprador</th><th className="px-5 py-3">Origem/status</th><th className="px-5 py-3">Membro vendedor</th></tr></thead>
              <tbody className="divide-y divide-gray-800/80">
                {participantes.map((participante) => <tr key={participante.id} className="text-gray-200">
                  <td className="px-5 py-4 align-top"><span className="font-mono text-base font-semibold text-white">{String(participante.numero).padStart(2, "0")}</span></td>
                  <td className="px-5 py-4 align-top"><div className="font-medium text-white">{participante.nome}</div><div className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Phone className="h-3 w-3" /> {participante.telefone}</div></td>
                  <td className="px-5 py-4 align-top"><div className="text-xs text-gray-200">{origemLabel(participante.origem)}</div><div className="mt-1 text-xs text-gray-500">{statusLabel(participante.status)}{participante.origem === "manual" ? ` · pagamento: ${participante.pagamento_manual_status}` : ""}</div></td>
                  <td className="px-5 py-4 align-top"><select aria-label={`Vendedor do número ${participante.numero}`} value={participante.vendedor_membro_id || ""} onChange={(event) => void alterarVendedor(participante, event.target.value)} disabled={sellerSaving === participante.id} className="min-w-56 rounded-md border border-gray-700 bg-ohel-bg px-3 py-2 text-xs text-white outline-none focus:border-ohel-blue"><option value="">Sem vendedor atribuído</option>{membros.map((membro) => <option key={membro.id} value={membro.id}>{membro.nome}{membro.codigo_membro ? ` · ${membro.codigo_membro}` : ""}</option>)}</select>{sellerSaving === participante.id && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-gray-400" />}</td>
                </tr>)}
                {participantes.length === 0 && <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-500">Nenhum número ocupado ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-5"><div className="mb-4 flex items-center gap-2 text-violet-300"><UserPlus className="h-5 w-5" /><h2 className="font-semibold text-white">Cadastrar número já vendido</h2></div><p className="mb-4 text-xs leading-5 text-gray-400">Use apenas para vendas feitas fora da página pública. O número é validado atomicamente e fica separado de lançamentos financeiros.</p>
            <form onSubmit={cadastrarNumero} className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ohel-silver">Número *</label><input required inputMode="numeric" min={sorteio.numero_inicial} max={sorteio.numero_final} type="number" value={form.numero} onChange={(event) => updateForm("numero", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm" placeholder={`${sorteio.numero_inicial}–${sorteio.numero_final}`} />
              <label className="block text-xs font-semibold uppercase tracking-wider text-ohel-silver">Membro vendedor *</label><select required value={form.vendedorMembroId} onChange={(event) => updateForm("vendedorMembroId", event.target.value)} className="input-ohel w-full rounded-lg px-4 py-3 text-sm"><option value="">Selecione...</option>{membros.map((membro) => <option key={membro.id} value={membro.id}>{membro.nome}{membro.codigo_membro ? ` · ${membro.codigo_membro}` : ""}</option>)}</select>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1"><div><label className="block text-xs font-semibold uppercase tracking-wider text-ohel-silver">Nome do comprador *</label><input required minLength={2} maxLength={150} value={form.nome} onChange={(event) => updateForm("nome", event.target.value)} className="input-ohel mt-2 w-full rounded-lg px-4 py-3 text-sm" /></div><div><label className="block text-xs font-semibold uppercase tracking-wider text-ohel-silver">Telefone *</label><input required minLength={8} maxLength={30} value={form.telefone} onChange={(event) => updateForm("telefone", event.target.value)} className="input-ohel mt-2 w-full rounded-lg px-4 py-3 text-sm" /></div></div>
              <div><label className="block text-xs font-semibold uppercase tracking-wider text-ohel-silver">Observação</label><textarea maxLength={500} value={form.observacoes} onChange={(event) => updateForm("observacoes", event.target.value)} className="input-ohel mt-2 min-h-20 w-full rounded-lg px-4 py-3 text-sm" placeholder="Opcional; não cria lançamento financeiro." /></div>
              <Button type="submit" disabled={savingManual || membros.length === 0} className="w-full"><Save className="h-4 w-4" />{savingManual ? "Cadastrando..." : "Cadastrar número"}</Button>
            </form>
          </Card>

          <Card className="p-5"><div className="mb-4 flex items-center gap-2 text-violet-300"><ImageIcon className="h-5 w-5" /><h2 className="font-semibold text-white">Foto do prêmio</h2></div>{sorteio.cartaz_url ? <img src={sorteio.cartaz_url} alt={`Foto do prêmio de ${sorteio.nome}`} className="mb-4 aspect-square w-full rounded-xl border border-gray-800 bg-ohel-bg object-cover" /> : <div className="mb-4 flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-gray-700 bg-ohel-bg/60 text-center text-xs text-gray-500">Nenhuma foto cadastrada</div>}<div className="grid grid-cols-1 gap-2"><label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-700 px-3 py-2.5 text-sm text-gray-200 hover:border-ohel-blue has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"><Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Enviar foto"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={enviarFoto} disabled={uploading || generating} className="sr-only" /></label><Button type="button" variant="secondary" onClick={() => void gerarFoto()} disabled={generating || uploading}><Sparkles className="h-4 w-4" />{generating ? "Gerando e salvando..." : "IA gerar foto (opcional)"}</Button></div><p className="mt-3 text-[11px] leading-4 text-gray-500">JPEG, PNG ou WebP até 8 MB. A IA só é chamada por este botão; se falhar, a foto atual é preservada.</p></Card>
        </div>
      </div>
    </div>
  );
}
