"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Baby, Check, Clock3, Loader2, Plus, Search, Users, X } from "lucide-react";

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

type Tab = "criancas" | "salas" | "checkin";

export default function InfantilPage() {
  const [tab, setTab] = useState<Tab>("criancas");
  const [churchId, setChurchId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [children, setChildren] = useState<Crianca[]>([]);
  const [rooms, setRooms] = useState<Sala[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
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
    if (user.role !== "admin" && user.grupo_id) {
      const { data: permission, error: permissionError } = await supabase
        .from("grupos_permissoes")
        .select("id")
        .eq("grupo_id", user.grupo_id)
        .eq("modulo", "infantil")
        .eq("acao", "ler")
        .maybeSingle();
      if (permissionError) throw permissionError;
      if (!permission) throw new Error("Seu grupo não tem acesso ao Departamento Infantil.");
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
    setChildren((childRows ?? []) as Crianca[]);
    setRooms((roomRows ?? []) as Sala[]);
    setCheckins((checkinRows ?? []) as Checkin[]);
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
        </>
      )}
    </div>
  );
}
