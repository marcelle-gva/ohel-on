"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { CalendarDays, Search, Ticket, Users } from "lucide-react";

type Evento = { id: string; nome: string; data_inicio: string };
type Inscricao = { id: string; evento_id: string; nome: string; telefone: string; status: string; created_at: string };

export default function InscricoesEventosPage() {
  const [events, setEvents] = useState<Evento[]>([]);
  const [registrations, setRegistrations] = useState<Inscricao[]>([]);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error("Sua sessão expirou. Entre novamente.");
        const { data: profile, error: profileError } = await supabase.from("usuarios")
          .select("igreja_id").eq("id", authData.user.id).single();
        if (profileError) throw profileError;
        if (!profile.igreja_id) throw new Error("Igreja do usuário não identificada.");
        const [{ data: eventRows, error: eventsError }, { data: registrationRows, error: registrationsError }] = await Promise.all([
          supabase.from("eventos").select("id, nome, data_inicio").eq("igreja_id", profile.igreja_id).order("data_inicio", { ascending: false }),
          supabase.from("inscricoes_eventos").select("id, evento_id, nome, telefone, status, created_at").eq("igreja_id", profile.igreja_id).order("created_at", { ascending: false }),
        ]);
        if (eventsError) throw eventsError;
        if (registrationsError) throw registrationsError;
        if (cancelled) return;
        setEvents((eventRows ?? []) as Evento[]);
        setRegistrations((registrationRows ?? []) as Inscricao[]);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as inscrições.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const eventMap = useMemo(() => new Map(events.map(event => [event.id, event])), [events]);
  const filtered = registrations.filter(registration => {
    const eventName = eventMap.get(registration.evento_id)?.nome ?? "";
    return (!eventFilter || registration.evento_id === eventFilter)
      && `${registration.nome} ${registration.telefone} ${eventName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10">
      <header className="flex items-center gap-3"><span className="rounded-xl bg-sky-500/10 p-3 text-sky-300"><Ticket className="h-6 w-6" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Eventos</p><h1 className="text-2xl font-bold text-white">Inscrições</h1><p className="mt-1 text-sm text-gray-400">Participantes inscritos nos eventos da igreja.</p></div></header>
      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <Card className="border-gray-800 bg-gray-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-gray-300"><Users className="h-4 w-4 text-gray-500" />{registrations.length} inscrições</div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2"><Search className="h-4 w-4 text-gray-500" /><input aria-label="Buscar inscrição" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou telefone" className="w-36 bg-transparent text-sm text-white outline-none" /></label><select aria-label="Filtrar por evento" value={eventFilter} onChange={event => setEventFilter(event.target.value)} className="input-ohel rounded-lg px-3 py-2 text-sm"><option value="">Todos os eventos</option>{events.map(event => <option key={event.id} value={event.id}>{event.nome}</option>)}</select></div></div>
        {loading ? <p className="py-12 text-center text-sm text-gray-400">Carregando inscrições…</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-gray-800 text-xs uppercase text-gray-500"><tr><th className="px-3 py-3">Participante</th><th className="px-3 py-3">Evento</th><th className="px-3 py-3">Telefone</th><th className="px-3 py-3">Data</th><th className="px-3 py-3">Status</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-gray-800">{filtered.map(registration => { const event = eventMap.get(registration.evento_id); return <tr key={registration.id} className="text-gray-300"><td className="px-3 py-3 font-medium text-gray-100">{registration.nome}</td><td className="px-3 py-3">{event?.nome ?? "Evento indisponível"}</td><td className="px-3 py-3">{registration.telefone}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-gray-500" />{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(registration.created_at))}</span></td><td className="px-3 py-3">{registration.status}</td><td className="px-3 py-3 text-right">{event && <Link href={`/eventos/${event.id}/inscricoes`} className="text-xs font-semibold text-sky-300 hover:text-sky-200">Gerenciar evento</Link>}</td></tr>; })}</tbody></table>{!filtered.length && <p className="py-12 text-center text-sm text-gray-500">Nenhuma inscrição encontrada.</p>}</div>
        )}
      </Card>
    </div>
  );
}
