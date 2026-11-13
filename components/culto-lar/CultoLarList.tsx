"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CultoLarListResult, CultoLarPostDTO, CultoLarStatus, CultoLarVisao } from "@/lib/culto-lar";
import { cultoLarJson, CULTOLAR_ACCESS_LOST } from "./culto-lar-client";
import { CultoLarFoto } from "./CultoLarFoto";
import styles from "./culto-lar.module.css";

function dataBR(value: string) {
  const partes = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "Data não informada";
}

export function CultoLarList({ visao, refreshKey, onEdit }: { visao: CultoLarVisao; refreshKey: number; onEdit?: (post: CultoLarPostDTO) => void }) {
  const [result, setResult] = useState<CultoLarListResult | null>(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<CultoLarStatus | "todos">("Pendente");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [savingId, setSavingId] = useState("");
  const [rejeitando, setRejeitando] = useState("");
  const [motivo, setMotivo] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);

  const carregar = useCallback(async () => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    const number = ++requestNumber.current;
    controllerRef.current = controller;
    setCarregando(true);
    try {
      const params = new URLSearchParams({ visao, page: String(page), pageSize: "8" });
      if (visao === "moderacao") params.set("status", status);
      const resposta = await cultoLarJson<CultoLarListResult>(`/api/culto-lar?${params}`, { signal: controller.signal });
      if (controller.signal.aborted || number !== requestNumber.current) return;
      if (!Array.isArray(resposta.posts) || !resposta.pagination) throw new Error("Não foi possível carregar esta página do mural.");
      setResult(resposta);
      setErro("");
    } catch (error) {
      if (!controller.signal.aborted && number === requestNumber.current) setErro(error instanceof Error ? error.message : "Não foi possível atualizar o mural.");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (!controller.signal.aborted && number === requestNumber.current) setCarregando(false);
    }
  }, [visao, page, status]);

  useEffect(() => {
    const limpar = () => {
      requestNumber.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      setResult(null);
      setRejeitando("");
      setMotivo("");
      setCarregando(false);
      setErro("O acesso precisa ser confirmado novamente. Entre na sua conta ou atualize a página.");
    };
    const refresh = () => { if (!document.hidden) void carregar(); };
    const timer = window.setTimeout(() => void carregar(), 0);
    const interval = window.setInterval(refresh, 30000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") limpar(); });
    window.addEventListener(CULTOLAR_ACCESS_LOST, limpar);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      requestNumber.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      subscription.unsubscribe();
      window.removeEventListener(CULTOLAR_ACCESS_LOST, limpar);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [carregar, refreshKey]);

  async function decidir(post: CultoLarPostDTO, novoStatus: "Aprovado" | "Rejeitado") {
    if (savingId) return;
    setSavingId(post.id);
    setMensagem("");
    setErro("");
    try {
      await cultoLarJson(`/api/culto-lar/${post.id}/moderacao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: novoStatus, versao: post.versao, motivo: novoStatus === "Rejeitado" ? motivo.trim() || null : null }) });
      setMensagem(novoStatus === "Aprovado" ? "Envio aprovado. Palavra e foto já podem ser vistas pelos membros da igreja." : "Envio rejeitado. Ele continua restrito ao autor e à liderança.");
      setRejeitando("");
      setMotivo("");
      controllerRef.current?.abort();
      controllerRef.current = null;
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a decisão.");
    } finally { setSavingId(""); }
  }

  const posts = result?.posts || [];
  return (
    <section aria-label={visao === "moderacao" ? "Revisão de Culto no Lar" : visao === "meus" ? "Meus envios de Culto no Lar" : "Mural de Culto no Lar"} className="flex flex-col gap-5">
      <div className={`${styles.header} items-center`}>
        <p className={styles.hint}>{visao === "mural" ? "Somente encontros aprovados da sua igreja. Atualização automática ao voltar à aba e a cada 30 segundos." : visao === "meus" ? "Acompanhe seus envios. Editar um conteúdo já aprovado exige uma nova aprovação." : "Confira a Palavra e a foto da versão atual antes de decidir. A publicação é exclusiva para os membros da igreja."}</p>
        <button type="button" onClick={() => void carregar()} disabled={carregando || Boolean(savingId)} className={styles.secondary}><RefreshCw size={15} className={carregando ? "animate-spin" : ""} />Atualizar</button>
      </div>
      {visao === "moderacao" && <label className={`${styles.label} max-w-xs`}>Status da revisão<select value={status} onChange={(event) => { setResult(null); setPage(0); setStatus(event.target.value as CultoLarStatus | "todos"); }} className={styles.input}><option value="Pendente">Pendentes</option><option value="Aprovado">Aprovados</option><option value="Rejeitado">Rejeitados</option><option value="todos">Todos</option></select></label>}
      {mensagem && <p role="status" className={`${styles.message} ${styles.success}`}>{mensagem}</p>}
      {erro && <p role="alert" className={`${styles.message} ${styles.error}`}>{erro} {result && "O conteúdo abaixo é da última atualização. Atualize antes de tomar uma decisão."}</p>}
      {carregando && <p role="status" className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={17} className="animate-spin" />Carregando envios...</p>}
      {!carregando && !erro && !posts.length && <div className={styles.empty}>{visao === "meus" ? "Você ainda não enviou um culto no lar. Use Compartilhar encontro para começar." : visao === "moderacao" ? "Nenhum envio encontrado neste status." : "Ainda não há encontros aprovados. Quando a liderança aprovar, a Palavra e a foto aparecerão aqui."}</div>}
      <div className={styles.grid}>
        {posts.map((post) => <article key={post.id} className={styles.post}>
          <div className={styles.meta}><span>{dataBR(post.data_culto)}</span><span className={styles.badge} data-status={post.status}>{post.status === "Pendente" ? "Aguardando aprovação" : post.status}</span></div>
          <div><h3 className={styles.postTitle}>{post.titulo || `Culto no lar · ${post.casa_nome}`}</h3><p className="mt-1 text-sm text-gray-400">{post.casa_nome} · Compartilhado por {post.autor.nome}</p></div>
          <CultoLarFoto key={`${post.id}-${post.versao}`} id={post.id} versao={post.versao} alt={`Encontro de Culto no Lar · ${post.casa_nome}`} />
          {post.referencia && <p className={styles.reference}>{post.referencia}</p>}
          {post.palavra.length > 400 && visao !== "moderacao" ? <details><summary className="cursor-pointer text-sm leading-7 text-gray-300 focus-visible:outline-blue-300">{post.palavra.slice(0, 250)}… <span className="block text-blue-300">Ler a Palavra completa</span></summary><p className={`${styles.word} mt-3`}>{post.palavra}</p></details> : <p className={styles.word}>{post.palavra}</p>}
          {post.motivo_rejeicao && <p className={`${styles.message} ${styles.error}`}>Orientação da liderança: {post.motivo_rejeicao}</p>}
          {visao === "meus" && onEdit && <button type="button" onClick={() => onEdit(post)} className={`${styles.secondary} self-start`}><Pencil size={15} />Editar meu envio</button>}
          {visao === "moderacao" && post.status === "Pendente" && <div className="mt-auto flex flex-col gap-3 border-t border-gray-800 pt-4">
            <p className={styles.hint}>Revisão {post.versao} · A decisão vale somente para esta versão.</p>
            {rejeitando === post.id && <label className={styles.label}>Orientação ao autor (opcional)<textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={500} rows={3} className={styles.input} placeholder="Explique o que precisa ser ajustado." /></label>}
            <div className={styles.actions}><button type="button" disabled={Boolean(savingId) || Boolean(erro)} onClick={() => void decidir(post, "Aprovado")} className={styles.approve}>{savingId === post.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Aprovar e compartilhar</button>
              {rejeitando === post.id ? <><button type="button" disabled={Boolean(savingId) || Boolean(erro)} onClick={() => void decidir(post, "Rejeitado")} className={styles.reject}>Confirmar rejeição</button><button type="button" onClick={() => { setRejeitando(""); setMotivo(""); }} disabled={Boolean(savingId)} className={styles.secondary}>Cancelar</button></> : <button type="button" disabled={Boolean(savingId) || Boolean(erro)} onClick={() => { setRejeitando(post.id); setMotivo(""); }} className={styles.reject}><X size={15} />Rejeitar</button>}</div>
          </div>}
        </article>)}
      </div>
      {result && (page > 0 || result.pagination.has_more) && <nav aria-label="Páginas do mural" className={`${styles.actions} justify-center`}><button type="button" onClick={() => { setResult(null); setPage((value) => Math.max(0, value - 1)); }} disabled={page === 0 || carregando || Boolean(savingId)} className={styles.secondary}><ChevronLeft size={15} />Anterior</button><span className={styles.hint}>Página {page + 1}{result.pagination.total !== null ? ` · ${result.pagination.total} envios` : ""}</span><button type="button" onClick={() => { setResult(null); setPage((value) => value + 1); }} disabled={!result.pagination.has_more || carregando || Boolean(savingId)} className={styles.secondary}>Próxima<ChevronRight size={15} /></button></nav>}
    </section>
  );
}
