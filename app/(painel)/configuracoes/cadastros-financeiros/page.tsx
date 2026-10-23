"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Input } from "@/components/ui/Input";
import { CreditCard, Pencil, Plus, Trash2, Wallet } from "lucide-react";

interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: "Receita" | "Despesa";
}

interface FormaPagamento {
  id: string;
  nome: string;
}

export default function CadastrosFinanceirosPage() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [nomeCategoria, setNomeCategoria] = useState("");
  const [tipoCategoria, setTipoCategoria] = useState<CategoriaFinanceira["tipo"]>("Receita");
  const [nomeForma, setNomeForma] = useState("");
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null);
  const [editandoForma, setEditandoForma] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState({
    isOpen: false,
    type: "success" as "success" | "error",
    title: "",
    message: "",
  });

  useEffect(() => {
    const carregar = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Sua sessão expirou. Entre novamente.");

        const { data: usuario, error: usuarioError } = await supabase
          .from("usuarios")
          .select("igreja_id")
          .eq("id", session.user.id)
          .single();
        if (usuarioError) throw usuarioError;
        if (!usuario.igreja_id) throw new Error("A conta não está vinculada a uma igreja.");
        setIgrejaId(usuario.igreja_id);

        const [categoriasResult, formasResult] = await Promise.all([
          supabase
            .from("categorias_financeiras")
            .select("id, nome, tipo")
            .eq("igreja_id", usuario.igreja_id)
            .order("nome"),
          supabase
            .from("formas_pagamento")
            .select("id, nome")
            .eq("igreja_id", usuario.igreja_id)
            .order("nome"),
        ]);

        if (categoriasResult.error) throw categoriasResult.error;
        if (formasResult.error) throw formasResult.error;
        setCategorias((categoriasResult.data ?? []) as CategoriaFinanceira[]);
        setFormasPagamento((formasResult.data ?? []) as FormaPagamento[]);
      } catch (error) {
        console.error("Falha ao carregar cadastros financeiros:", error);
        setModal({
          isOpen: true,
          type: "error",
          title: "Erro ao carregar",
          message: error instanceof Error ? error.message : "Não foi possível carregar os cadastros financeiros.",
        });
      } finally {
        setCarregando(false);
      }
    };
    void carregar();
  }, []);

  const mostrarErro = (title: string, error: unknown) => {
    console.error(title, error);
    setModal({
      isOpen: true,
      type: "error",
      title,
      message: error instanceof Error ? error.message : "Não foi possível concluir a operação.",
    });
  };

  const adicionarCategoria = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nome = nomeCategoria.trim();
    if (!igrejaId || !nome) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .insert([{ igreja_id: igrejaId, nome, tipo: tipoCategoria }])
        .select("id, nome, tipo")
        .single();
      if (error) throw error;
      setCategorias((current) => [...current, data as CategoriaFinanceira].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNomeCategoria("");
    } catch (error) {
      mostrarErro("Erro ao adicionar categoria", error);
    } finally {
      setSalvando(false);
    }
  };

  const salvarCategoria = async (id: string) => {
    const nome = nomeEdicao.trim();
    if (!igrejaId || !nome) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .update({ nome })
        .eq("igreja_id", igrejaId)
        .eq("id", id)
        .select("id, nome, tipo")
        .single();
      if (error) throw error;
      setCategorias((current) => current.map((item) => item.id === id ? data as CategoriaFinanceira : item));
      setEditandoCategoria(null);
    } catch (error) {
      mostrarErro("Erro ao editar categoria", error);
    } finally {
      setSalvando(false);
    }
  };

  const excluirCategoria = async (id: string) => {
    if (!igrejaId) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .delete()
        .eq("igreja_id", igrejaId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Categoria não encontrada ou sem permissão para excluir.");
      setCategorias((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      mostrarErro("Erro ao excluir categoria", error);
    } finally {
      setSalvando(false);
    }
  };

  const adicionarForma = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nome = nomeForma.trim();
    if (!igrejaId || !nome) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .insert([{ igreja_id: igrejaId, nome }])
        .select("id, nome")
        .single();
      if (error) throw error;
      setFormasPagamento((current) => [...current, data as FormaPagamento].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNomeForma("");
    } catch (error) {
      mostrarErro("Erro ao adicionar forma de pagamento", error);
    } finally {
      setSalvando(false);
    }
  };

  const salvarForma = async (id: string) => {
    const nome = nomeEdicao.trim();
    if (!igrejaId || !nome) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .update({ nome })
        .eq("igreja_id", igrejaId)
        .eq("id", id)
        .select("id, nome")
        .single();
      if (error) throw error;
      setFormasPagamento((current) => current.map((item) => item.id === id ? data as FormaPagamento : item));
      setEditandoForma(null);
    } catch (error) {
      mostrarErro("Erro ao editar forma de pagamento", error);
    } finally {
      setSalvando(false);
    }
  };

  const excluirForma = async (id: string) => {
    if (!igrejaId) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .delete()
        .eq("igreja_id", igrejaId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Forma de pagamento não encontrada ou sem permissão para excluir.");
      setFormasPagamento((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      mostrarErro("Erro ao excluir forma de pagamento", error);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <div className="p-10 text-center text-gray-400">Carregando cadastros financeiros...</div>;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal
        isOpen={modal.isOpen}
        onClose={() => setModal((current) => ({ ...current, isOpen: false }))}
        type={modal.type}
        title={modal.title}
        message={modal.message}
      />

      <div>
        <h1 className="text-xl font-bold text-white">Cadastros Financeiros</h1>
        <p className="text-sm text-gray-400 mt-1">Cadastre opções usadas nos formulários financeiros desta igreja.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5 border-gray-800 bg-ohel-surface">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-ohel-blue" /> Categorias de receitas e despesas
          </h2>
          <form onSubmit={adicionarCategoria} className="grid grid-cols-1 sm:grid-cols-[1fr_130px_auto] gap-2 mb-5">
            <Input
              label="Nova categoria"
              value={nomeCategoria}
              onChange={(event) => setNomeCategoria(event.target.value)}
              required
              maxLength={100}
            />
            <div className="flex flex-col gap-2">
              <label htmlFor="tipo-categoria" className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Tipo</label>
              <select
                id="tipo-categoria"
                value={tipoCategoria}
                onChange={(event) => setTipoCategoria(event.target.value as CategoriaFinanceira["tipo"])}
                className="input-ohel w-full px-3 py-2.5 rounded-lg text-sm"
              >
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>
            <Button type="submit" disabled={salvando} className="self-end w-auto px-3">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </form>

          <div className="flex flex-col divide-y divide-gray-800">
            {categorias.map((categoria) => (
              <div key={categoria.id} className="py-2 flex items-center gap-2">
                {editandoCategoria === categoria.id ? (
                  <>
                    <Input value={nomeEdicao} onChange={(event) => setNomeEdicao(event.target.value)} maxLength={100} />
                    <Button type="button" disabled={salvando} onClick={() => void salvarCategoria(categoria.id)} className="w-auto px-2">Salvar</Button>
                    <Button type="button" variant="secondary" onClick={() => setEditandoCategoria(null)} className="w-auto px-2">Cancelar</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-white">{categoria.nome}</span>
                    <span className="text-xs text-gray-400">{categoria.tipo}</span>
                    <button type="button" aria-label={`Editar ${categoria.nome}`} onClick={() => { setEditandoCategoria(categoria.id); setNomeEdicao(categoria.nome); }} className="p-2 text-gray-400 hover:text-white">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label={`Excluir ${categoria.nome}`} disabled={salvando} onClick={() => void excluirCategoria(categoria.id)} className="p-2 text-red-400 hover:text-red-300 disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {categorias.length === 0 && <p className="py-3 text-xs text-gray-500">Nenhuma categoria cadastrada.</p>}
          </div>
        </Card>

        <Card className="p-5 border-gray-800 bg-ohel-surface">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-green-400" /> Formas de pagamento
          </h2>
          <form onSubmit={adicionarForma} className="flex gap-2 mb-5">
            <Input
              label="Nova forma de pagamento"
              value={nomeForma}
              onChange={(event) => setNomeForma(event.target.value)}
              required
              maxLength={100}
            />
            <Button type="submit" disabled={salvando} className="self-end w-auto px-3">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </form>

          <div className="flex flex-col divide-y divide-gray-800">
            {formasPagamento.map((forma) => (
              <div key={forma.id} className="py-2 flex items-center gap-2">
                {editandoForma === forma.id ? (
                  <>
                    <Input value={nomeEdicao} onChange={(event) => setNomeEdicao(event.target.value)} maxLength={100} />
                    <Button type="button" disabled={salvando} onClick={() => void salvarForma(forma.id)} className="w-auto px-2">Salvar</Button>
                    <Button type="button" variant="secondary" onClick={() => setEditandoForma(null)} className="w-auto px-2">Cancelar</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-white">{forma.nome}</span>
                    <button type="button" aria-label={`Editar ${forma.nome}`} onClick={() => { setEditandoForma(forma.id); setNomeEdicao(forma.nome); }} className="p-2 text-gray-400 hover:text-white">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label={`Excluir ${forma.nome}`} disabled={salvando} onClick={() => void excluirForma(forma.id)} className="p-2 text-red-400 hover:text-red-300 disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {formasPagamento.length === 0 && <p className="py-3 text-xs text-gray-500">Nenhuma forma de pagamento cadastrada.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
