"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { MapPin, Package, Plus, Trash2 } from "lucide-react";

type Option = { id: string; nome: string };

export default function CadastrosPatrimonioPage() {
  const [churchId, setChurchId] = useState<string | null>(null);
  const [types, setTypes] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [newType, setNewType] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
        const [{ data: typeRows, error: typesError }, { data: placeRows, error: placesError }] = await Promise.all([
          supabase.from("patrimonio_tipos").select("id, nome").eq("igreja_id", profile.igreja_id).order("nome"),
          supabase.from("patrimonio_localizacoes").select("id, nome").eq("igreja_id", profile.igreja_id).order("nome"),
        ]);
        if (typesError) throw typesError;
        if (placesError) throw placesError;
        if (cancelled) return;
        setChurchId(profile.igreja_id);
        setTypes(typeRows ?? []);
        setLocations(placeRows ?? []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os cadastros.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const addOption = async (kind: "tipo" | "local") => {
    if (!churchId) return;
    const name = (kind === "tipo" ? newType : newLocation).trim();
    if (!name) return;
    const table = kind === "tipo" ? "patrimonio_tipos" : "patrimonio_localizacoes";
    setError("");
    setNotice("");
    try {
      const { data, error: insertError } = await supabase.from(table)
        .insert({ igreja_id: churchId, nome: name })
        .select("id, nome")
        .single();
      if (insertError) throw insertError;
      if (kind === "tipo") {
        setTypes(current => [...current, data].sort((a, b) => a.nome.localeCompare(b.nome)));
        setNewType("");
      } else {
        setLocations(current => [...current, data].sort((a, b) => a.nome.localeCompare(b.nome)));
        setNewLocation("");
      }
      setNotice("Cadastro adicionado.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível adicionar o cadastro.");
    }
  };

  const deleteOption = async (kind: "tipo" | "local", id: string) => {
    const table = kind === "tipo" ? "patrimonio_tipos" : "patrimonio_localizacoes";
    setError("");
    setNotice("");
    try {
      const { data, error: deleteError } = await supabase.from(table)
        .delete().eq("igreja_id", churchId).eq("id", id).select("id").single();
      if (deleteError) throw deleteError;
      if (!data) throw new Error("O cadastro não foi encontrado para exclusão.");
      if (kind === "tipo") setTypes(current => current.filter(option => option.id !== id));
      else setLocations(current => current.filter(option => option.id !== id));
      setNotice("Cadastro excluído. Os bens já registrados mantêm o valor salvo.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o cadastro.");
    }
  };

  const section = (
    title: string,
    description: string,
    icon: ReactNode,
    options: Option[],
    value: string,
    setValue: (value: string) => void,
    kind: "tipo" | "local",
  ) => (
    <Card className="border-gray-800 bg-gray-900/70 p-5">
      <div className="mb-4 flex items-start gap-3">{icon}<div><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-gray-500">{description}</p></div></div>
      <div className="mb-4 flex gap-2"><input value={value} onChange={event => setValue(event.target.value)} maxLength={100} placeholder={`Novo ${kind === "tipo" ? "tipo" : "local"}`} className="input-ohel min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm" /><button type="button" onClick={() => void addOption(kind)} disabled={!value.trim()} className="rounded-lg bg-sky-500 px-3 text-slate-950 disabled:opacity-50"><Plus className="h-4 w-4" /></button></div>
      <div className="space-y-2">{options.map(option => <div key={option.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2.5"><span className="text-sm text-gray-200">{option.nome}</span><button type="button" onClick={() => void deleteOption(kind, option.id)} aria-label={`Excluir ${option.nome}`} className="rounded-md p-1.5 text-gray-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
      {!options.length && <p className="py-6 text-center text-sm text-gray-500">Nenhum cadastro encontrado.</p>}
    </Card>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
      <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Tabelas mestras</p><h1 className="mt-1 text-2xl font-bold text-white">Cadastros do patrimônio</h1><p className="mt-1 text-sm text-gray-400">Os tipos e locais daqui preenchem os campos do inventário e das movimentações.</p></header>
      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      {loading ? <p className="py-12 text-center text-sm text-gray-400">Carregando cadastros…</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {section("Tipos de bens", "Categorias disponíveis ao cadastrar itens no inventário.", <Package className="h-5 w-5 text-sky-300" />, types, newType, setNewType, "tipo")}
          {section("Localizações", "Locais disponíveis no cadastro e transferência de bens.", <MapPin className="h-5 w-5 text-sky-300" />, locations, newLocation, setNewLocation, "local")}
        </div>
      )}
    </div>
  );
}
