"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, House, ShieldCheck } from "lucide-react";
import { useAccess } from "@/components/layout/AccessShell";
import type { ContextoAcesso } from "@/lib/access";
import { supabase } from "@/lib/supabase";
import { canModerate, type CultoLarPostDTO, type CultoLarVisao } from "@/lib/culto-lar";
import { CultoLarForm } from "./CultoLarForm";
import { CultoLarList } from "./CultoLarList";
import { CULTOLAR_ACCESS_LOST } from "./culto-lar-client";
import styles from "./culto-lar.module.css";

type Aba = CultoLarVisao | "novo";

export function CultoLarArea({ moderationOnly = false }: { moderationOnly?: boolean }) {
  const contexto = useAccess();
  if (!contexto) return null;
  return <CultoLarAreaContent key={`${contexto.usuarioId}-${contexto.igrejaId}-${contexto.membro?.id || "equipe"}`} contexto={contexto} moderationOnly={moderationOnly} />;
}

function CultoLarAreaContent({ contexto, moderationOnly }: { contexto: ContextoAcesso; moderationOnly: boolean }) {
  const [aba, setAba] = useState<Aba>(moderationOnly ? "moderacao" : "mural");
  const [editando, setEditando] = useState<CultoLarPostDTO | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [acessoPerdido, setAcessoPerdido] = useState(false);
  const moderador = canModerate(contexto);

  useEffect(() => {
    const limpar = () => {
      setAcessoPerdido(true);
      setEditando(null);
      setMensagem("");
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") limpar(); });
    window.addEventListener(CULTOLAR_ACCESS_LOST, limpar);
    return () => { subscription.unsubscribe(); window.removeEventListener(CULTOLAR_ACCESS_LOST, limpar); };
  }, []);

  const tabs: { value: Aba; label: string }[] = moderationOnly
    ? [{ value: "moderacao", label: "Revisar envios" }]
    : [{ value: "mural", label: "Mural da igreja" }, { value: "meus", label: "Meus envios" }, { value: "novo", label: "Compartilhar encontro" }, ...(moderador ? [{ value: "moderacao" as const, label: "Revisão da liderança" }] : [])];

  function trocarAba(value: Aba) {
    setAba(value);
    setEditando(null);
    setMensagem("");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>{contexto.igrejaNome} · {moderationOnly ? "Revisão da liderança" : "Área do Membro"}</p><h1 className={styles.title}><House className="shrink-0 text-blue-300" size={27} />Culto no Lar</h1><p className={styles.subtitle}>{moderationOnly ? "Uma Palavra, uma casa, um testemunho. Confira os encontros enviados e aprove somente o conteúdo que deve ser compartilhado." : "A igreja também se encontra em casa. Compartilhe a Palavra ministrada e uma foto do seu encontro, e acompanhe os cultos nos lares da sua comunidade."}</p></div>
        <Link href={moderationOnly ? "/secretaria/mural" : "/area-membro"} className={styles.secondary}><ArrowLeft size={15} />{moderationOnly ? "Voltar ao Mural" : "Meu dashboard"}</Link>
      </header>
      <p className={`${styles.message} flex items-start gap-3`}><ShieldCheck size={19} className="shrink-0 mt-0.5 text-green-400" /><span>Palavra e foto aparecem aos membros da sua igreja somente após aprovação. Envios pendentes ou rejeitados ficam restritos ao autor e à liderança autorizada. Não inclua endereços pessoais.</span></p>
      {(moderationOnly || aba === "moderacao") && !moderador ? <div className={styles.empty}>Somente o administrador ou a liderança autorizada pode revisar estes envios. As permissões vêm do grupo da igreja, não do cargo informado no cadastro.</div> : acessoPerdido ? <div className={styles.empty}><p>Seu acesso precisa ser confirmado novamente. O conteúdo e as fotos foram retirados desta tela.</p><button type="button" onClick={() => { setAcessoPerdido(false); setRefreshKey((n) => n + 1); }} className={`${styles.secondary} mt-4`}>Confirmar acesso e tentar novamente</button></div> : <>
        <nav className={styles.tabs} aria-label="Áreas de Culto no Lar">{tabs.map((tab) => <button key={tab.value} type="button" aria-pressed={aba === tab.value} onClick={() => trocarAba(tab.value)} className={styles.tab}>{tab.label}</button>)}</nav>
        {mensagem && <p role="status" className={`${styles.message} ${styles.success}`}>{mensagem}</p>}
        {aba === "novo" || editando ? <CultoLarForm key={editando ? `${editando.id}-${editando.versao}` : "novo"} post={editando} onSaved={() => { setEditando(null); setAba("meus"); setRefreshKey((n) => n + 1); setMensagem("Seu envio foi recebido e está aguardando a aprovação da liderança. Você pode acompanhar o status em Meus envios."); }} onCancel={() => { setEditando(null); setAba("meus"); }} /> : <CultoLarList key={aba} visao={aba} refreshKey={refreshKey} onEdit={aba === "meus" ? (post) => { setEditando(post); setMensagem(""); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined} />}
      </>}
    </div>
  );
}
