"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Baby, CalendarDays, Check, Clock3, Loader2, MessageCircle, Plus, Search, Send, Users, X } from "lucide-react";

type Crianca = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  sala_id: string | null;
  responsavel_nome: string;
  responsavel_telefone: string;
  responsavel_whatsapp_opt_in: boolean;
  alergias: string | null;
  status: string;
};

type Sala = {
  id: string;
  nome: string;
  faixa_etaria: string | null;
  capacidade: number | null;
  responsavel: string | null;
  ativa: boolean;
};

type Checkin = {
  id: string;
  crianca_id: string;
  sala_id: string | null;
  responsavel_retirada: string;
  codigo_retirada: string;
  checkin_at: string;
};

type DiaCheckin = {
  crianca_id: string;
  sala_id: string | null;
};

type ComunicacaoMode = "todos" | "sala" | "dia" | "individual";
type Tab = "criancas" | "salas" | "checkin" | "comunicacoes";

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateRange(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function personalizarMensagem(message: string, child: Crianca) {
  return message
    .replaceAll("{responsavel}", child.responsavel_nome)
    .replaceAll("{crianca}", child.nome);
}

export default function InfantilPage() {
  const [tab, setTab] = useState<Tab>("criancas");
  const [comunicacaoMode, setComunicacaoMode] = useState<ComunicacaoMode>("todos");
  const [churchId, setChurchId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [canSendCommunications, setCanSendCommunications] = useState(false);
  const [children, setChildren] = useState<Crianca[]>([]);
  const [rooms, setRooms] = useState<Sala[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [dayCheckins, setDayCheckins] = useState<DiaCheckin[]>([]);
  const [dayCheckinsLoading, setDayCheckinsLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => localDateValue(new Date()));
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [message, setMessage] = useState("Olá, {responsavel}! Lembramos que a paz do Senhor esteja com sua família. Seguimos à disposição sobre a criança {crianca}.");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [childForm, setChildForm] = useState({
    nome: "",
    data_nascimento: "",
    sala_id: "",
    responsavel_nome: "",
    responsavel_telefone: "",
    alergias: "",
    responsavel_whatsapp_opt_in: false,
  });
  const [roomForm, setRoomForm] = useState({ nome: "", faixa_etaria: "", capacidade: "", responsavel: "" });
  const [checkinForm, setCheckinForm] = useState({ crianca_id: "", sala_id: "", responsavel_retirada: "" });
  const [checkoutNames, setCheckoutNames] = useState<Record<string, string>>({});

  const load = async () => {
    setError("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error("Sua sessão expirou. Entre novamente.");
    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("igreja_id, grupo_id, role")
      .eq("id", authData.user.id)
      .single();
    if (userError) throw userError;
    if (!user.igreja_id) throw new Error("Não foi possível identificar a igreja.");
    let canReadKids = user.role === "admin";
    let canSendWhatsApp = user.role === "admin";
    if (user.role !== "admin" && user.grupo_id) {
      const { data: permissions, error: permissionError } = await supabase
        .from("grupos_permissoes")
        .select("modulo, acao")
        .eq("grupo_id", user.grupo_id)
        .in("modulo", ["infantil", "comunicacoes"])
        .in("acao", ["ler", "criar", "editar"]);
      if (permissionError) throw permissionError;
      canReadKids = Boolean(permissions?.some(permission => permission.modulo === "infantil" && permission.acao === "ler"));
      canSendWhatsApp = Boolean(permissions?.some(permission =>
        permission.modulo === "comunicacoes" && ["criar", "editar"].includes(permission.acao),
      ));
      if (!canReadKids) throw new Error("Seu grupo não tem acesso ao Departamento Infantil.");
    }
    const [{ data: childRows, error: childrenError }, { data: roomRows, error: roomsError }, { data: checkinRows, error: checkinsError }] =
      await Promise.all([
        supabase.from("criancas").select("*").eq("igreja_id", user.igreja_id).order("nome"),
        supabase.from("salas_infantis").select("*").eq("igreja_id", user.igreja_id).order("nome"),
        supabase.from("checkins_infantis").select("*").eq("igreja_id", user.igreja_id).is("checkout_at", null).order("checkin_at", { ascending: false }),
      ]);
    if (childrenError) throw childrenError;
    if (roomsError) throw roomsError;
    if (checkinsError) throw checkinsError;
    setChurchId(user.igreja_id);
    setUserId(authData.user.id);
    setCanSendCommunications(canSendWhatsApp);
    setChildren((childRows ?? []) as Crianca[]);
    setRooms((roomRows ?? []) as Sala[]);
    setCheckins((checkinRows ?? []) as Checkin[]);
    setSelectedRoomId(current => current || (roomRows ?? []).find(room => room.ativa)?.id || "");
    setSelectedChildIds((childRows ?? [])
      .filter(child => child.status === "Ativo" && child.responsavel_whatsapp_opt_in && child.responsavel_telefone?.trim())
      .slice(0, 100)
      .map(child => child.id));
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void load()
        .catch(loadError => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o módulo Kids.");
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

  const childrenById = useMemo(() => new Map(children.map(child => [child.id, child])), [children]);
  const roomsById = useMemo(() => new Map(rooms.map(room => [room.id, room])), [rooms]);
  const filteredChildren = children.filter(child => child.nome.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const eligibleCommunicationChildren = useMemo(
    () => children.filter(child => child.status === "Ativo" && child.responsavel_whatsapp_opt_in && child.responsavel_telefone.trim()),
    [children],
  );
  const dayCheckinChildIds = useMemo(() => new Set(dayCheckins.map(checkin => checkin.crianca_id)), [dayCheckins]);
  const communicationChildren = useMemo(() => {
    if (comunicacaoMode === "sala") {
      return eligibleCommunicationChildren.filter(child => child.sala_id === selectedRoomId);
    }
    if (comunicacaoMode === "dia") {
      return eligibleCommunicationChildren.filter(child => dayCheckinChildIds.has(child.id));
    }
    if (comunicacaoMode === "individual") return eligibleCommunicationChildren;
    return eligibleCommunicationChildren;
  }, [comunicacaoMode, dayCheckinChildIds, eligibleCommunicationChildren, selectedRoomId]);
  const selectedCommunicationChildren = useMemo(
    () => communicationChildren.filter(child => selectedChildIds.includes(child.id)),
    [communicationChildren, selectedChildIds],
  );

  useEffect(() => {
    if (comunicacaoMode !== "dia" || !churchId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const { start, end } = localDateRange(selectedDate);
      setDayCheckinsLoading(true);
      void (async () => {
        try {
          const { data, error: checkinsError } = await supabase.from("checkins_infantis")
            .select("crianca_id, sala_id")
            .eq("igreja_id", churchId)
            .gte("checkin_at", start)
            .lt("checkin_at", end);
          if (cancelled) return;
          if (checkinsError) {
            setError("Não foi possível carregar os check-ins desse dia.");
            setDayCheckins([]);
            return;
          }
          setDayCheckins((data ?? []) as DiaCheckin[]);
          const checkedInIds = new Set((data ?? []).map(checkin => checkin.crianca_id));
          setSelectedChildIds(eligibleCommunicationChildren
            .filter(child => checkedInIds.has(child.id))
            .slice(0, 100)
            .map(child => child.id));
        } catch (checkinError) {
          console.error("Falha ao carregar check-ins para segmentação Kids:", checkinError);
          if (!cancelled) setError("Não foi possível carregar os check-ins desse dia.");
        } finally {
          if (!cancelled) setDayCheckinsLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [churchId, comunicacaoMode, eligibleCommunicationChildren, selectedDate]);

  const setCommunicationMode = (mode: ComunicacaoMode) => {
    setComunicacaoMode(mode);
    setError("");
    setNotice("");
    if (mode === "todos") {
      setSelectedChildIds(eligibleCommunicationChildren.slice(0, 100).map(child => child.id));
    } else if (mode === "sala") {
      const roomId = selectedRoomId || rooms.find(room => room.ativa)?.id || "";
      setSelectedRoomId(roomId);
      setSelectedChildIds(eligibleCommunicationChildren.filter(child => child.sala_id === roomId).slice(0, 100).map(child => child.id));
    } else if (mode === "individual") {
      setSelectedChildIds([]);
    } else {
      setSelectedChildIds([]);
      setDayCheckins([]);
    }
  };

  const selectCommunicationRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedChildIds(eligibleCommunicationChildren.filter(child => child.sala_id === roomId).slice(0, 100).map(child => child.id));
  };

  const selectCommunicationDate = (date: string) => {
    setSelectedDate(date);
    setDayCheckins([]);
    setSelectedChildIds([]);
  };

  const toggleCommunicationChild = (childId: string) => {
    setSelectedChildIds(current => current.includes(childId)
      ? current.filter(id => id !== childId)
      : current.length >= 100 ? current : [...current, childId]);
  };

  const toggleAllCommunicationChildren = () => {
    const visibleIds = communicationChildren.map(child => child.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedChildIds.includes(id));
    setSelectedChildIds(current => allSelected
      ? current.filter(id => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])].slice(0, 100));
  };

  const sendKidsMessage = async () => {
    if (!canSendCommunications) {
      setError("Seu grupo precisa da permissão de criar ou editar em Comunicações para enviar mensagens.");
      return;
    }
    if (!selectedCommunicationChildren.length) {
      setError("Selecione ao menos um responsável com consentimento WhatsApp.");
      return;
    }
    if (!message.trim()) {
      setError("Escreva a mensagem antes de enviar.");
      return;
    }
    if (message.length > 4096) {
      setError("A mensagem ultrapassa o limite de 4.096 caracteres do WhatsApp.");
      return;
    }
    const confirmed = window.confirm(
      `Enviar uma mensagem personalizada para ${selectedCommunicationChildren.length} responsável(is)? O texto livre só pode ser enviado dentro da janela de atendimento de 24 horas da Meta.`,
    );
    if (!confirmed) return;

    setSendingMessage(true);
    setError("");
    setNotice("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");

      const personalizedRecipients = selectedCommunicationChildren.map(child => ({
        child,
        text: personalizarMensagem(message.trim(), child),
      }));
      const tooLong = personalizedRecipients
        .filter(recipient => recipient.text.length > 4096)
        .map(({ child }) => `${child.responsavel_nome} (${child.nome}): a mensagem excede 4.096 caracteres.`);
      const validRecipients = personalizedRecipients.filter(recipient => recipient.text.length <= 4096);
      if (!validRecipients.length) {
        setError(`Nenhuma mensagem foi enviada. ${tooLong.join(" · ")}`);
        return;
      }

      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: validRecipients.map(({ child, text }) => ({
            id: child.id,
            type: "responsavel_kids",
            text,
          })),
          type: "texto",
        }),
      });
      const result = await response.json() as {
        error?: string;
        message?: string;
        accepted?: number;
        failed?: number;
        results?: Array<{ name: string; error?: string }>;
        historyIncompleteFor?: string[];
      };
      if (!response.ok && response.status !== 207) throw new Error(result.error ?? "Não foi possível enviar as mensagens.");

      const failures = [
        ...tooLong,
        ...(result.results ?? []).filter(item => item.error).map(item => `${item.name}: ${item.error}`),
      ];
      if (result.historyIncompleteFor?.length) {
        failures.push("O histórico de uma ou mais mensagens não foi confirmado; verifique antes de tentar novamente.");
      }
      if (failures.length) {
        setError(`${result.accepted ?? 0} mensagem(ns) aceita(s) pela Meta; ${failures.length} falha(s): ${failures.join(" · ")}`);
      } else {
        setNotice(`${result.accepted ?? 0} mensagem(ns) aceita(s) pela Meta. ${result.message ?? "A entrega final depende da confirmação da Meta."}`);
        setSelectedChildIds([]);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar as mensagens.");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAddChild = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!churchId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data, error: insertError } = await supabase.from("criancas").insert({
        igreja_id: churchId,
        nome: childForm.nome.trim(),
        data_nascimento: childForm.data_nascimento || null,
        sala_id: childForm.sala_id || null,
        responsavel_nome: childForm.responsavel_nome.trim(),
        responsavel_telefone: childForm.responsavel_telefone.trim(),
        responsavel_whatsapp_opt_in: childForm.responsavel_whatsapp_opt_in,
        alergias: childForm.alergias.trim() || null,
      }).select("*").single();
      if (insertError) throw insertError;
      setChildren(current => [...current, data as Crianca].sort((a, b) => a.nome.localeCompare(b.nome)));
      if (comunicacaoMode === "todos" && data.status === "Ativo" && data.responsavel_whatsapp_opt_in && data.responsavel_telefone?.trim()) {
        setSelectedChildIds(current => current.length < 100 ? [...current, data.id] : current);
      }
      setChildForm({ nome: "", data_nascimento: "", sala_id: "", responsavel_nome: "", responsavel_telefone: "", alergias: "", responsavel_whatsapp_opt_in: false });
      setNotice("Cadastro infantil salvo.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível cadastrar a criança.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!churchId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data, error: insertError } = await supabase.from("salas_infantis").insert({
        igreja_id: churchId,
        nome: roomForm.nome.trim(),
        faixa_etaria: roomForm.faixa_etaria.trim() || null,
        capacidade: roomForm.capacidade ? Number(roomForm.capacidade) : null,
        responsavel: roomForm.responsavel.trim() || null,
      }).select("*").single();
      if (insertError) throw insertError;
      setRooms(current => [...current, data as Sala].sort((a, b) => a.nome.localeCompare(b.nome)));
      setRoomForm({ nome: "", faixa_etaria: "", capacidade: "", responsavel: "" });
      setNotice("Sala cadastrada.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível cadastrar a sala.");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!churchId || !userId) return;
    const child = childrenById.get(checkinForm.crianca_id);
    if (!child) return setError("Selecione uma criança cadastrada.");
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data, error: insertError } = await supabase.from("checkins_infantis").insert({
        igreja_id: churchId,
        crianca_id: child.id,
        sala_id: checkinForm.sala_id || child.sala_id,
        responsavel_retirada: checkinForm.responsavel_retirada.trim() || child.responsavel_nome,
        checkin_por: userId,
      }).select("*").single();
      if (insertError) throw insertError;
      setCheckins(current => [data as Checkin, ...current]);
      setCheckinForm({ crianca_id: "", sala_id: "", responsavel_retirada: "" });
      setNotice(`Check-in de ${child.nome} confirmado. Código de retirada: ${(data as Checkin).codigo_retirada}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível confirmar o check-in.");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = async (checkin: Checkin) => {
    const pickupName = checkoutNames[checkin.id]?.trim();
    if (!pickupName) return setError("Informe quem está retirando a criança.");
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data, error: updateError } = await supabase.from("checkins_infantis")
        .update({ checkout_at: new Date().toISOString(), checkout_por: userId, responsavel_retirada: pickupName })
        .eq("id", checkin.id)
        .is("checkout_at", null)
        .select("id")
        .single();
      if (updateError) throw updateError;
      if (!data) throw new Error("O check-in já foi encerrado.");
      setCheckins(current => current.filter(item => item.id !== checkin.id));
      setNotice("Saída registrada.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível registrar a saída.");
    } finally {
      setSaving(false);
    }
  };

  const tabClass = (value: Tab) =>
    `inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${tab === value ? "bg-sky-500/15 text-sky-200" : "text-gray-400 hover:bg-white/5 hover:text-white"}`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">OHEL Kids</p>
          <h1 className="text-2xl font-bold text-white">Departamento Infantil</h1>
          <p className="mt-1 text-sm text-gray-400">Acolhimento, salas e check-in com segurança.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Card className="flex items-center gap-3 border-gray-800 bg-gray-900/70 px-4 py-3"><Baby className="h-5 w-5 text-sky-300" /><div><p className="text-lg font-bold text-white">{children.length}</p><p className="text-xs text-gray-500">Crianças</p></div></Card>
          <Card className="flex items-center gap-3 border-gray-800 bg-gray-900/70 px-4 py-3"><Users className="h-5 w-5 text-violet-300" /><div><p className="text-lg font-bold text-white">{rooms.filter(room => room.ativa).length}</p><p className="text-xs text-gray-500">Salas ativas</p></div></Card>
          <Card className="flex items-center gap-3 border-gray-800 bg-gray-900/70 px-4 py-3"><Clock3 className="h-5 w-5 text-emerald-300" /><div><p className="text-lg font-bold text-white">{checkins.length}</p><p className="text-xs text-gray-500">Recebidas agora</p></div></Card>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      <Card className="border-gray-800 bg-gray-900/60 p-2">
        <nav className="flex flex-wrap gap-1" aria-label="Áreas Kids">
          <button type="button" className={tabClass("criancas")} onClick={() => setTab("criancas")}><Baby className="h-4 w-4" /> Crianças</button>
          <button type="button" className={tabClass("salas")} onClick={() => setTab("salas")}><Users className="h-4 w-4" /> Salas</button>
          <button type="button" className={tabClass("checkin")} onClick={() => setTab("checkin")}><Check className="h-4 w-4" /> Check-in e saída</button>
          <button type="button" className={tabClass("comunicacoes")} onClick={() => setTab("comunicacoes")}><MessageCircle className="h-4 w-4" /> Comunicações</button>
        </nav>
      </Card>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <>
          {tab === "criancas" && (
            <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
              <Card className="border-gray-800 bg-gray-900/70 p-5">
                <h2 className="mb-4 font-semibold text-white">Novo cadastro</h2>
                <form onSubmit={handleAddChild} className="flex flex-col gap-3">
                  <input required placeholder="Nome completo da criança" value={childForm.nome} onChange={event => setChildForm(current => ({ ...current, nome: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-gray-400">Nascimento<input type="date" value={childForm.data_nascimento} onChange={event => setChildForm(current => ({ ...current, data_nascimento: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
                    <select value={childForm.sala_id} onChange={event => setChildForm(current => ({ ...current, sala_id: event.target.value }))} className="input-ohel self-end rounded-lg px-3 py-2.5 text-sm"><option value="">Sem sala definida</option>{rooms.filter(room => room.ativa).map(room => <option key={room.id} value={room.id}>{room.nome}</option>)}</select>
                  </div>
                  <input required placeholder="Responsável" value={childForm.responsavel_nome} onChange={event => setChildForm(current => ({ ...current, responsavel_nome: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm" />
                  <input required type="tel" placeholder="Telefone do responsável" value={childForm.responsavel_telefone} onChange={event => setChildForm(current => ({ ...current, responsavel_telefone: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm" />
                  <textarea placeholder="Alergias ou cuidados importantes" value={childForm.alergias} onChange={event => setChildForm(current => ({ ...current, alergias: event.target.value }))} className="input-ohel min-h-20 rounded-lg px-3 py-2.5 text-sm" />
                  <label className="flex items-start gap-2 text-xs text-gray-400"><input type="checkbox" checked={childForm.responsavel_whatsapp_opt_in} onChange={event => setChildForm(current => ({ ...current, responsavel_whatsapp_opt_in: event.target.checked }))} className="mt-0.5 accent-emerald-500" />Responsável autorizou receber mensagens pelo WhatsApp.</label>
                  <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? "Salvando…" : "Cadastrar criança"}</button>
                </form>
              </Card>
              <Card className="border-gray-800 bg-gray-900/70 p-5">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Crianças cadastradas</h2><p className="mt-1 text-xs text-gray-500">Dados restritos à igreja</p></div><label className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2"><Search className="h-4 w-4 text-gray-500" /><input aria-label="Buscar criança" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar" className="w-28 bg-transparent text-sm text-white outline-none" /></label></div>
                <div className="divide-y divide-gray-800">
                  {filteredChildren.map(child => <div key={child.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-200">{child.nome}</p><p className="mt-1 truncate text-xs text-gray-500">{roomsById.get(child.sala_id ?? "")?.nome ?? "Sem sala"} · Responsável: {child.responsavel_nome}</p>{child.alergias && <p className="mt-1 text-xs text-amber-300">Cuidado: {child.alergias}</p>}</div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${child.status === "Ativo" ? "bg-emerald-500/10 text-emerald-300" : "bg-gray-800 text-gray-400"}`}>{child.status}</span></div>)}
                  {!filteredChildren.length && <p className="py-8 text-center text-sm text-gray-500">Nenhuma criança encontrada.</p>}
                </div>
              </Card>
            </section>
          )}

          {tab === "salas" && (
            <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
              <Card className="border-gray-800 bg-gray-900/70 p-5">
                <h2 className="mb-4 font-semibold text-white">Cadastrar sala</h2>
                <form onSubmit={handleAddRoom} className="flex flex-col gap-3">
                  <input required placeholder="Nome da sala" value={roomForm.nome} onChange={event => setRoomForm(current => ({ ...current, nome: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm" />
                  <input placeholder="Faixa etária (ex.: 4 a 7 anos)" value={roomForm.faixa_etaria} onChange={event => setRoomForm(current => ({ ...current, faixa_etaria: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm" />
                  <div className="grid gap-3 sm:grid-cols-2"><input type="number" min="1" placeholder="Capacidade" value={roomForm.capacidade} onChange={event => setRoomForm(current => ({ ...current, capacidade: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm" /><input placeholder="Responsável da sala" value={roomForm.responsavel} onChange={event => setRoomForm(current => ({ ...current, responsavel: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm" /></div>
                  <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? "Salvando…" : "Cadastrar sala"}</button>
                </form>
              </Card>
              <Card className="border-gray-800 bg-gray-900/70 p-5">
                <h2 className="mb-4 font-semibold text-white">Salas cadastradas</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {rooms.map(room => <div key={room.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium text-gray-100">{room.nome}</p><p className="mt-1 text-xs text-gray-500">{room.faixa_etaria || "Faixa etária não definida"}</p></div><span className="text-xs text-gray-400">{room.capacidade ?? "—"} vagas</span></div><p className="mt-3 text-xs text-gray-500">{room.responsavel || "Sem responsável definido"}</p><p className={`mt-3 text-xs ${room.ativa ? "text-emerald-300" : "text-gray-500"}`}>{room.ativa ? "Ativa" : "Inativa"}</p></div>)}
                  {!rooms.length && <p className="py-8 text-sm text-gray-500">Cadastre a primeira sala.</p>}
                </div>
              </Card>
            </section>
          )}

          {tab === "checkin" && (
            <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-gray-800 bg-gray-900/70 p-5">
                <h2 className="mb-1 font-semibold text-white">Receber criança</h2><p className="mb-4 text-xs text-gray-500">Cada criança só pode ter um check-in ativo por vez.</p>
                <form onSubmit={handleCheckin} className="flex flex-col gap-3">
                  <select required value={checkinForm.crianca_id} onChange={event => {
                    const child = childrenById.get(event.target.value);
                    setCheckinForm(current => ({ ...current, crianca_id: event.target.value, sala_id: child?.sala_id ?? "" }));
                  }} className="input-ohel rounded-lg px-3 py-2.5 text-sm"><option value="">Selecione a criança</option>{children.filter(child => child.status === "Ativo" && !checkins.some(checkin => checkin.crianca_id === child.id)).map(child => <option key={child.id} value={child.id}>{child.nome}</option>)}</select>
                  <select value={checkinForm.sala_id} onChange={event => setCheckinForm(current => ({ ...current, sala_id: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm"><option value="">Usar sala cadastrada</option>{rooms.filter(room => room.ativa).map(room => <option key={room.id} value={room.id}>{room.nome}</option>)}</select>
                  <input placeholder="Responsável autorizado para retirada" value={checkinForm.responsavel_retirada} onChange={event => setCheckinForm(current => ({ ...current, responsavel_retirada: event.target.value }))} className="input-ohel rounded-lg px-3 py-2.5 text-sm" />
                  <button disabled={saving || !children.length} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><Check className="h-4 w-4" />{saving ? "Confirmando…" : "Confirmar check-in"}</button>
                </form>
              </Card>
              <Card className="border-gray-800 bg-gray-900/70 p-5">
                <h2 className="mb-4 font-semibold text-white">Crianças recebidas</h2>
                <div className="space-y-3">
                  {checkins.map(checkin => {
                    const child = childrenById.get(checkin.crianca_id);
                    return <div key={checkin.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-100">{child?.nome ?? "Criança"}</p><p className="mt-1 text-xs text-gray-500">{roomsById.get(checkin.sala_id ?? "")?.nome ?? "Sala não definida"} · Recebida às {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(checkin.checkin_at))}</p></div><span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold tracking-wider text-amber-200">{checkin.codigo_retirada}</span></div><div className="mt-3 flex gap-2"><input aria-label={`Responsável pela retirada de ${child?.nome ?? "criança"}`} placeholder="Nome de quem retira" value={checkoutNames[checkin.id] ?? ""} onChange={event => setCheckoutNames(current => ({ ...current, [checkin.id]: event.target.value }))} className="input-ohel min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" /><button type="button" disabled={saving} onClick={() => void handleCheckout(checkin)} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:border-gray-500 disabled:opacity-50"><X className="h-4 w-4" />Registrar saída</button></div></div>;
                  })}
                  {!checkins.length && <p className="py-8 text-center text-sm text-gray-500">Nenhuma criança está aguardando retirada.</p>}
                </div>
              </Card>
            </section>
          )}

          {tab === "comunicacoes" && (
            <section className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
              <Card className="flex flex-col gap-5 border-gray-800 bg-gray-900/70 p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="font-semibold text-white">Comunicação com responsáveis</h2>
                    <p className="mt-1 text-xs text-gray-500">Mensagens personalizadas pelo WhatsApp.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Destinatários (modo de envio)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["todos", "Todos os responsáveis"],
                      ["sala", "Por sala"],
                      ["dia", "Por dia / culto"],
                      ["individual", "Individual"],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={comunicacaoMode === mode}
                        onClick={() => setCommunicationMode(mode)}
                        className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                          comunicacaoMode === mode
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                            : "border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {comunicacaoMode === "sala" && (
                  <label className="flex flex-col gap-2 text-xs text-gray-400">
                    Sala
                    <select
                      value={selectedRoomId}
                      onChange={event => selectCommunicationRoom(event.target.value)}
                      className="input-ohel w-full rounded-lg px-3 py-2.5 text-sm"
                    >
                      <option value="">Selecione uma sala</option>
                      {rooms.filter(room => room.ativa).map(room => (
                        <option key={room.id} value={room.id}>{room.nome}</option>
                      ))}
                    </select>
                  </label>
                )}

                {comunicacaoMode === "dia" && (
                  <label className="flex flex-col gap-2 text-xs text-gray-400">
                    Dia do check-in
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-emerald-300" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={event => selectCommunicationDate(event.target.value)}
                        className="input-ohel min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm text-white"
                      />
                    </span>
                    <span className="text-[10px] text-gray-500">A seleção usa os check-ins registrados nessa data. O cadastro atual não separa cultos por horário.</span>
                  </label>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="kids-whatsapp-message" className="text-xs font-medium text-gray-300">Mensagem WhatsApp</label>
                    <span className="text-right text-[10px] text-emerald-300">Variáveis: {"{responsavel}"}, {"{crianca}"}</span>
                  </div>
                  <textarea
                    id="kids-whatsapp-message"
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    maxLength={4096}
                    className="input-ohel min-h-32 w-full rounded-xl px-3 py-3 text-sm leading-6"
                    placeholder="Olá, {responsavel}! Uma mensagem sobre {crianca}…"
                  />
                  <p className="mt-1 text-right text-[10px] text-gray-500">{message.length}/4.096</p>
                </div>

                {!canSendCommunications && (
                  <p role="status" className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                    Seu grupo precisa da permissão de criar ou editar em Comunicações para enviar mensagens.
                  </p>
                )}

                <div className="flex flex-col gap-3 border-t border-gray-800 pt-4">
                  <p className="text-[10px] leading-4 text-gray-500">
                    Só aparecem responsáveis ativos com consentimento WhatsApp registrado. Limite de 100 por envio; texto livre depende da janela de atendimento de 24 horas da Meta.
                  </p>
                  <button
                    type="button"
                    onClick={() => void sendKidsMessage()}
                    disabled={sendingMessage || !canSendCommunications || selectedCommunicationChildren.length === 0 || !message.trim()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sendingMessage ? "Enviando…" : `Enviar WhatsApp (${selectedCommunicationChildren.length} selecionado${selectedCommunicationChildren.length === 1 ? "" : "s"})`}
                  </button>
                  <Link href="/configuracoes/comunicacoes" className="text-center text-[11px] text-emerald-300 hover:text-emerald-200">
                    Configurações do WhatsApp
                  </Link>
                </div>
              </Card>

              <Card className="overflow-hidden border-gray-800 bg-gray-900/70 p-0">
                <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-4 sm:px-5">
                  <div>
                    <h2 className="font-semibold text-white">Lista de destinatários ({selectedCommunicationChildren.length})</h2>
                    <p className="mt-1 text-xs text-gray-500">Marque ou desmarque os responsáveis que receberão a mensagem.</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAllCommunicationChildren}
                    disabled={!communicationChildren.length || dayCheckinsLoading}
                    className="shrink-0 text-xs font-medium text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
                  >
                    {communicationChildren.length > 0 && communicationChildren.every(child => selectedChildIds.includes(child.id)) ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </div>

                {dayCheckinsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Carregando check-ins…</div>
                ) : (
                  <div className="max-h-[560px] divide-y divide-gray-800 overflow-y-auto">
                    {communicationChildren.map(child => (
                      <label key={child.id} className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-gray-800/50 sm:px-5 ${selectedChildIds.includes(child.id) ? "bg-emerald-500/[0.04]" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selectedChildIds.includes(child.id)}
                          onChange={() => toggleCommunicationChild(child.id)}
                          className="h-4 w-4 shrink-0 accent-emerald-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-100">{child.nome}</span>
                          <span className="mt-1 block truncate text-xs text-gray-400">
                            Responsável: <span className="text-gray-300">{child.responsavel_nome}</span>
                            {" · "}{roomsById.get(child.sala_id ?? "")?.nome ?? "Sem sala"}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] text-emerald-300">{child.responsavel_telefone}</span>
                      </label>
                    ))}
                    {!communicationChildren.length && (
                      <p className="px-5 py-12 text-center text-sm text-gray-500">
                        {comunicacaoMode === "sala" && !selectedRoomId
                          ? "Selecione uma sala para listar os responsáveis."
                          : comunicacaoMode === "dia"
                            ? "Nenhuma criança com consentimento e check-in nesta data."
                            : "Nenhum responsável ativo com telefone e consentimento WhatsApp registrados."}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
