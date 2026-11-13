"use client";

import { useState } from "react";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { MAX_CULTO_LAR_FOTO_BYTES, validarCamposCultoLar, type CultoLarPostDTO } from "@/lib/culto-lar";
import { cultoLarJson } from "./culto-lar-client";
import { CultoLarFoto } from "./CultoLarFoto";
import styles from "./culto-lar.module.css";

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function CultoLarForm({ post, onSaved, onCancel }: { post?: CultoLarPostDTO | null; onSaved: () => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const validacao = validarCamposCultoLar(Object.fromEntries(form.entries()));
    if (!validacao.ok) { setErro(validacao.error); return; }
    const foto = form.get("foto");
    if ((!post && (!(foto instanceof File) || foto.size === 0)) || (foto instanceof File && foto.size > MAX_CULTO_LAR_FOTO_BYTES)) {
      setErro(!post && (!(foto instanceof File) || foto.size === 0) ? "Escolha uma foto do culto no lar." : "A foto deve ter no máximo 4 MB.");
      return;
    }
    if (foto instanceof File && foto.size > 0 && !["image/jpeg", "image/png", "image/webp"].includes(foto.type)) {
      setErro("Escolha uma foto JPEG, PNG ou WebP."); return;
    }
    if (foto instanceof File && foto.size === 0) form.delete("foto");
    if (post) form.set("versao", String(post.versao));
    setSaving(true);
    setErro("");
    try {
      await cultoLarJson<{ post: CultoLarPostDTO }>(post ? `/api/culto-lar/${post.id}` : "/api/culto-lar", { method: post ? "PATCH" : "POST", body: form });
      onSaved();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar. Seus dados foram mantidos para tentar novamente.");
    } finally { setSaving(false); }
  }

  return (
    <section className={styles.panel} aria-labelledby="culto-lar-form-title">
      <h2 id="culto-lar-form-title" className="text-lg font-bold text-white">{post ? "Editar meu envio" : "Compartilhar um culto no lar"}</h2>
      <p className={`${styles.hint} mt-2 mb-5`}>Conte o que foi ministrado em casa. O envio ficará em análise e só aparecerá no mural da igreja depois da aprovação da liderança.</p>
      {post?.status === "Aprovado" && <p className={`${styles.message} mb-5`}>Ao salvar a edição, este envio sai do mural compartilhado e volta à aprovação, inclusive se você mantiver a foto.</p>}
      <form onSubmit={enviar} className={styles.form}>
        <fieldset disabled={saving} className={styles.form}>
          <div className={styles.two}>
            <label className={styles.label}>Casa ou família *<input name="casa_nome" defaultValue={post?.casa_nome || ""} placeholder="Ex.: Família Silva" required maxLength={150} className={styles.input} /><span className={styles.hint}>Não informe endereço completo, telefone ou localização da residência.</span></label>
            <label className={styles.label}>Data do culto *<input name="data_culto" type="date" defaultValue={post?.data_culto || hojeSaoPaulo()} min="1900-01-01" max="2200-12-31" required className={styles.input} /></label>
          </div>
          <div className={styles.two}>
            <label className={styles.label}>Título da mensagem<input name="titulo" defaultValue={post?.titulo || ""} maxLength={200} placeholder="Ex.: A paz de Cristo em nosso lar" className={styles.input} /></label>
            <label className={styles.label}>Referência bíblica<input name="referencia" defaultValue={post?.referencia || ""} maxLength={200} placeholder="Ex.: Josué 24:15" className={styles.input} /></label>
          </div>
          <label className={styles.label}>Palavra ministrada *<textarea name="palavra" defaultValue={post?.palavra || ""} required maxLength={20000} rows={8} placeholder="Compartilhe a Palavra, a reflexão e o que marcou este encontro." className={`${styles.input} resize-y`} /><span className={styles.hint}>Até 20.000 caracteres. A mensagem completa será preservada.</span></label>
          {post && <div><p className={`${styles.hint} mb-2`}>Foto atual. Escolha outra abaixo apenas se quiser substituí-la.</p><CultoLarFoto id={post.id} versao={post.versao} alt={`Culto no lar de ${post.casa_nome}`} /></div>}
          <label className={styles.label}>{post ? "Trocar a foto (opcional)" : "Foto do encontro *"}<input name="foto" type="file" accept="image/jpeg,image/png,image/webp" required={!post} className={`${styles.input} file:mr-3 file:rounded-md file:border-0 file:bg-blue-500/20 file:px-3 file:py-2 file:text-blue-200`} /><span className={styles.hint}>JPEG, PNG ou WebP, até 4 MB. A foto permanece protegida enquanto aguarda aprovação.</span></label>
          <label className={styles.check}><input type="checkbox" required name="autorizacao_imagem" value="true" /><span>Confirmo que tenho autorização para compartilhar esta foto e a mensagem com os membros da igreja. Para crianças e adolescentes retratados, tenho autorização do responsável.</span></label>
          {erro && <p role="alert" className={`${styles.message} ${styles.error}`}>{erro}</p>}
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{saving ? "Enviando com segurança..." : post ? "Salvar e enviar para nova aprovação" : "Enviar para aprovação"}</button>
            <button type="button" onClick={onCancel} className={styles.secondary} disabled={saving}>Cancelar</button>
          </div>
          <p className={`${styles.hint} flex items-start gap-2`}><ShieldCheck size={16} className="shrink-0 mt-0.5 text-green-400" />Antes da aprovação, somente você e a liderança autorizada poderão consultar o envio e a foto.</p>
        </fieldset>
      </form>
    </section>
  );
}
