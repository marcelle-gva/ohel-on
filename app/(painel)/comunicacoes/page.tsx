"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Check, Clock3, Loader2, MessageCircle, Search, Settings2, Users, X } from "lucide-react";

type Audience = "membros" | "kids";
type RecipientType = "membro" | "responsavel_kids";
type Recipient = { id: string; type: RecipientType; name: string; phone: string };
type MessageLog = {
  id: string;
  destinatario_telefone: string;
  tipo: "texto" | "modelo";
  conteudo: string;
  status: "aceita" | "enviada" | "entregue" | "lida" | "falhou";
  erro: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<MessageLog["status"], string> = {
  aceita: "Aceita pela Meta",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
  falhou: "Falhou",
};

export default function ComunicacoesPage() {
  const [audience, setAudience] = useState<Audience>("membros");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [history, setHistory] = useState<MessageLog[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [messageType, setMessageType] = useState<"texto" | "modelo">("texto");
  const [message, setMessage] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [templateParameters, setTemplateParameters] = useState("");
  const [kidsAudienceAllowed, setKidsAudienceAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error("Sua sessão expirou. Entre novamente.");
    const { data: profile, error: profileError } = await supabase
      .from("usuarios")
      .select("igreja_id, role, grupo_id")
      .eq("id", authData.user.id)
      .single();
    if (profileError) throw profileError;
    if (!profile.igreja_id) throw new Error("Igreja do usuário não identificada.");

    let canViewKids = profile.role === "admin";
    if (profile.grupo_id && profile.role !== "admin") {
      const { data: permissions, error: permissionsError } = await supabase
        .from("grupos_permissoes")
        .select("modulo, acao")
        .eq("grupo_id", profile.grupo_id)
        .in("modulo", ["comunicacoes", "infantil"])
        .in("acao", ["ler", "criar", "editar"]);
      if (permissionsError) throw permissionsError;
      canViewKids = Boolean(permissions?.some(permission => permission.modulo === "infantil" && permission.acao === "ler"));
      if (!permissions?.some(permission => permission.modulo === "comunicacoes" && permission.acao === "ler")) {
        throw new Error("Seu grupo não tem permissão para consultar as comunicações.");
      }
    }

    const [{ data: members, error: membersError }, { data: messages, error: messagesError }] = await Promise.all([
      supabase.from("membros").select("id, nome, telefone").eq("igreja_id", profile.igreja_id).eq("whatsapp_opt_in", true).order("nome"),
      supabase.from("mensagens_whatsapp").select("id, destinatario_telefone, tipo, conteudo, status, erro, created_at").eq("igreja_id", profile.igreja_id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (membersError) throw membersError;
    if (messagesError) throw messagesError;
    const options: Recipient[] = (members ?? [])
      .filter(member => member.telefone)
      .map(member => ({ id: member.id, type: "membro" as const, name: member.nome, phone: member.telefone }));

    if (canViewKids) {
      const { data: children, error: childrenError } = await supabase.from("criancas")
        .select("id, nome, responsavel_nome, responsavel_telefone")
        .eq("igreja_id", profile.igreja_id)
        .eq("responsavel_whatsapp_opt_in", true)
        .order("nome");
      if (childrenError) throw childrenError;
      options.push(...(children ?? [])
        .filter(child => child.responsavel_telefone)
        .map(child => ({ id: child.id, type: "responsavel_kids" as const, name: `${child.responsavel_nome} · ${child.nome}`, phone: child.responsavel_telefone })));
    }

    setRecipients(options);
    setHistory((messages ?? []) as MessageLog[]);
    setKidsAudienceAllowed(canViewKids);
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadData()
        .catch(loadError => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a central.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const audienceRecipients = useMemo(
    () => recipients.filter(recipient => audience === "membros" ? recipient.type === "membro" : recipient.type === "responsavel_kids"),
    [audience, recipients],
  );
  const filteredRecipients = audienceRecipients.filter(recipient =>
    `${recipient.name} ${recipient.phone}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  const toggleRecipient = (recipient: Recipient) => {
    const key = `${recipient.type}:${recipient.id}`;
    setSelected(current => current.includes(key)
      ? current.filter(item => item !== key)
      : current.length >= 100 ? current : [...current, key]);
  };

  const send = async () => {
    setSending(true);
    setError("");
    setNotice("");
    try {
      const selectedRecipients = recipients.filter(recipient => selected.includes(`${recipient.type}:${recipient.id}`));
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: selectedRecipients.map(recipient => ({ id: recipient.id, type: recipient.type })),
          type: messageType,
          text: message,
          templateName,
          language,
          templateParameters: templateParameters.split("\n").map(value => value.trim()).filter(Boolean),
        }),
      });
      const result = await response.json() as {
        error?: string;
        message?: string;
        accepted?: number;
        failed?: number;
      };
      if (!response.ok) throw new Error(result.error ?? "Falha no envio.");
      setNotice(`${result.message ?? "Solicitação concluída."} ${result.accepted ?? 0} aceita(s), ${result.failed ?? 0} falha(s).`);
      setSelected([]);
      await loadData();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar as mensagens.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-300"><MessageCircle className="h-6 w-6" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Relacionamento</p><h1 className="text-2xl font-bold text-white">Central de comunicações</h1><p className="mt-1 text-sm text-gray-400">Mensagens para contatos com consentimento registrado.</p></div></div>
        <Link href="/configuracoes/comunicacoes" className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white sm:self-auto"><Settings2 className="h-4 w-4" />Configurar WhatsApp</Link>
      </header>
      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-white">Nova mensagem</h2><p className="mt-1 text-xs text-gray-500">{selected.length}/100 destinatários selecionados</p></div><span className="flex items-center gap-1 text-xs text-emerald-300"><Users className="h-4 w-4" />{recipients.length} com consentimento</span></div>
              <div className="mb-4 flex gap-2"><button type="button" onClick={() => setMessageType("texto")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${messageType === "texto" ? "bg-emerald-500/15 text-emerald-200" : "text-gray-400 hover:bg-white/5"}`}>Texto (janela de 24h)</button><button type="button" onClick={() => setMessageType("modelo")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${messageType === "modelo" ? "bg-emerald-500/15 text-emerald-200" : "text-gray-400 hover:bg-white/5"}`}>Modelo aprovado</button></div>
              {messageType === "texto" ? <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={4096} placeholder="Escreva uma mensagem para contatos que falaram com a igreja nas últimas 24 horas…" className="input-ohel min-h-28 w-full rounded-lg px-3 py-2.5 text-sm" /> : <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1.5 text-xs text-gray-400">Nome aprovado na Meta<input value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="exemplo_aviso" className="input-ohel rounded-lg px-3 py-2.5 text-sm" /></label><label className="flex flex-col gap-1.5 text-xs text-gray-400">Idioma do modelo<input value={language} onChange={event => setLanguage(event.target.value)} placeholder="pt_BR" className="input-ohel rounded-lg px-3 py-2.5 text-sm" /></label><label className="flex flex-col gap-1.5 text-xs text-gray-400 sm:col-span-2">Parâmetros de corpo (um por linha)<textarea value={templateParameters} onChange={event => setTemplateParameters(event.target.value)} placeholder="1º valor&#10;2º valor" className="input-ohel min-h-20 rounded-lg px-3 py-2.5 text-sm" /><span className="text-[10px] text-gray-500">Use os parâmetros na mesma ordem definida no modelo da Meta.</span></label></div>}
              <div className="mt-5 flex items-center justify-between gap-3"><div className="flex gap-1 rounded-lg border border-gray-800 p-1"><button type="button" onClick={() => { setAudience("membros"); setSearch(""); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${audience === "membros" ? "bg-gray-800 text-white" : "text-gray-500"}`}>Membros</button>{kidsAudienceAllowed && <button type="button" onClick={() => { setAudience("kids"); setSearch(""); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${audience === "kids" ? "bg-gray-800 text-white" : "text-gray-500"}`}>Responsáveis Kids</button>}</div><label className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2"><Search className="h-4 w-4 text-gray-500" /><input aria-label="Buscar destinatários" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar contato" className="w-28 bg-transparent text-xs text-white outline-none" /></label></div>
              <div className="mt-3 max-h-64 divide-y divide-gray-800 overflow-y-auto rounded-lg border border-gray-800 px-3">
                {filteredRecipients.map(recipient => <label key={`${recipient.type}:${recipient.id}`} className="flex cursor-pointer items-center gap-3 py-3"><input type="checkbox" checked={selected.includes(`${recipient.type}:${recipient.id}`)} onChange={() => toggleRecipient(recipient)} className="h-4 w-4 accent-emerald-500" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-gray-200">{recipient.name}</span><span className="text-xs text-gray-500">{recipient.phone}</span></span>{selected.includes(`${recipient.type}:${recipient.id}`) && <Check className="h-4 w-4 text-emerald-300" />}</label>)}
                {!filteredRecipients.length && <p className="py-8 text-center text-sm text-gray-500">{audience === "membros" ? "Nenhum membro com telefone e consentimento registrados." : "Nenhum responsável Kids com telefone e consentimento registrados."}</p>}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] leading-4 text-gray-500">Envio limitado a contatos com opt-in. A aceitação da Meta não confirma entrega.</p><button type="button" onClick={() => void send()} disabled={sending || selected.length === 0 || (messageType === "texto" ? !message.trim() : !templateName.trim())} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Enviando…" : "Enviar mensagem"}</button></div>
            </Card>

            <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Histórico recente</h2><p className="mt-1 text-xs text-gray-500">Status atualizado pelo webhook da Meta</p></div><Clock3 className="h-5 w-5 text-gray-500" /></div>
              <div className="space-y-3">
                {history.map(item => <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-gray-200">{item.destinatario_telefone}</p><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.status === "falhou" ? "bg-rose-500/10 text-rose-300" : item.status === "lida" || item.status === "entregue" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{STATUS_LABELS[item.status]}</span></div><p className="mt-2 line-clamp-2 text-xs text-gray-400">{item.conteudo}</p><div className="mt-2 flex items-center justify-between text-[10px] text-gray-600"><span>{item.tipo === "modelo" ? "Modelo" : "Texto"}</span><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</span></div>{item.erro && <p className="mt-2 text-xs text-rose-300">{item.erro}</p>}</div>)}
                {!history.length && <p className="py-10 text-center text-sm text-gray-500">Ainda não há mensagens registradas.</p>}
              </div>
            </Card>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-100/80"><X className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p>Use texto livre somente dentro da janela de atendimento de 24 horas. Para enviar fora dela, use um modelo aprovado e respeite o consentimento e as regras vigentes da Meta.</p></div>
        </>
      )}
    </div>
  );
}
