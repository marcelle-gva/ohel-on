"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { User, MapPin, Church, CheckCircle, ShieldCheck, MessageCircle, Camera, ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./form.module.css";

type Etapa = "pessoais" | "endereco" | "adicionais";
interface ErroCampo { etapa: Etapa; campo: string; mensagem: string }
interface OpcaoCatalogo { id: string; nome: string }
interface OpcoesPreCadastroResponse { cargos?: OpcaoCatalogo[]; congregacoes?: OpcaoCatalogo[] }
const ETAPAS = [
  { id: "pessoais" as const, titulo: "Dados Pessoais", curto: "Pessoais", icone: User },
  { id: "endereco" as const, titulo: "Endereço", curto: "Endereço", icone: MapPin },
  { id: "adicionais" as const, titulo: "Informações Adicionais", curto: "Adicionais", icone: Church },
];
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const DADOS_INICIAIS = {
  nome: "", data_nascimento: "", sexo: "", estado_civil: "", cpf: "", email: "", telefone: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cargo: "Membro",
  congregacao_id: "", nome_pai: "", nome_mae: "",
};
const OUTRO_CARGO_VALUE = "__outro_cargo__";

function PreCadastroForm() {
  const searchParams = useSearchParams();
  const igrejaId = searchParams.get("igreja");
  const [activeTab, setActiveTab] = useState<Etapa>("pessoais");
  const [loading, setLoading] = useState(false);
  const [congregacoes, setCongregacoes] = useState<OpcaoCatalogo[]>([]);
  const [cargos, setCargos] = useState<OpcaoCatalogo[]>([]);
  const [isOutroCargo, setIsOutroCargo] = useState(false);
  const [outroCargo, setOutroCargo] = useState("");
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error" | "warning", title: "", message: "" });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [formData, setFormData] = useState(DADOS_INICIAIS);
  const [erro, setErro] = useState<ErroCampo | null>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const indice = ETAPAS.findIndex((etapa) => etapa.id === activeTab);

  useEffect(() => {
    let ativo = true;
    const fetchOpcoes = async () => {
      setCongregacoes([]);
      setCargos([]);
      if (!igrejaId) return;
      try {
        const response = await fetch(`/api/membros/opcoes-pre-cadastro?igreja=${encodeURIComponent(igrejaId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as OpcoesPreCadastroResponse;
        if (!ativo) return;
        setCongregacoes(Array.isArray(result.congregacoes) ? result.congregacoes : []);
        setCargos(Array.isArray(result.cargos) ? result.cargos : []);
      } catch {
        // O pré-cadastro continua disponível com as opções padrão se o catálogo não responder.
      }
    };
    void fetchOpcoes();
    return () => { ativo = false; };
  }, [igrejaId]);

  useEffect(() => {
    const fields = fieldsRef.current;
    if (!fields) return;
    if (erro?.etapa === activeTab) {
      const input = fields.querySelector<HTMLElement>(`[name="${erro.campo}"]`);
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ block: "center" });
    } else {
      fields.scrollTop = 0;
      fields.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    }
  }, [activeTab, erro]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((atual) => ({ ...atual, [event.target.name]: event.target.value }));
  };

  const handleCargoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const valor = event.target.value;
    if (valor === OUTRO_CARGO_VALUE) {
      setIsOutroCargo(true);
      setOutroCargo("");
      setFormData((atual) => ({ ...atual, cargo: "" }));
      return;
    }
    setIsOutroCargo(false);
    setOutroCargo("");
    setFormData((atual) => ({ ...atual, cargo: valor || "Membro" }));
  };

  const handleOutroCargoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const valor = event.target.value;
    setOutroCargo(valor);
    setFormData((atual) => ({ ...atual, cargo: valor }));
  };

  const validarPessoais = (): ErroCampo | null => {
    const falha = (campo: string, mensagem: string): ErroCampo => ({ etapa: "pessoais", campo, mensagem });
    if (formData.nome.trim().length < 3) return falha("nome", "Informe seu nome completo (pelo menos 3 caracteres).");
    if (!formData.telefone.trim()) return falha("telefone", "Informe seu telefone ou WhatsApp.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) return falha("email", "Informe um e-mail válido para acessar a Área do Membro.");
    if (senha.trim().length < 8) return falha("senha", "Crie uma senha com pelo menos 8 caracteres.");
    if (senha.trim() !== confirmarSenha.trim()) return falha("confirmar_senha", "As senhas não conferem. Repita a mesma senha nos dois campos.");
    if (foto && foto.size > 5 * 1024 * 1024) return falha("foto", "A foto deve ter no máximo 5 MB.");
    if (foto && !foto.type.startsWith("image/")) return falha("foto", "Escolha uma imagem para sua foto de perfil.");
    return null;
  };

  const mostrarErro = (falha: ErroCampo) => {
    setErro(falha);
    setActiveTab(falha.etapa);
  };

  const mudarEtapa = (destino: Etapa) => {
    if (loading) return;
    const indiceDestino = ETAPAS.findIndex((etapa) => etapa.id === destino);
    if (indiceDestino > indice) {
      const falha = validarPessoais();
      if (falha) return mostrarErro(falha);
    }
    setErro(null);
    setActiveTab(destino);
  };

  const prosseguir = () => {
    if (indice < ETAPAS.length - 1) mudarEtapa(ETAPAS[indice + 1].id);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (activeTab !== "adicionais") return prosseguir();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Link de pré-cadastro inválido. Solicite o QR Code à secretaria da sua igreja." });
    const falha = validarPessoais();
    if (falha) return mostrarErro(falha);
    if (isOutroCargo && !formData.cargo.trim()) return mostrarErro({ etapa: "adicionais", campo: "outro_cargo", mensagem: "Informe qual é o outro cargo eclesiástico." });
    if (!consentAccepted) return mostrarErro({ etapa: "adicionais", campo: "consent_accepted", mensagem: "Aceite o Termo de Consentimento e Privacidade para finalizar o pré-cadastro." });
    setErro(null);
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append("igreja_id", igrejaId);
      Object.entries(formData).forEach(([campo, valor]) => payload.append(campo, valor));
      payload.append("senha", senha);
      payload.append("confirmar_senha", confirmarSenha);
      payload.append("consent_accepted", String(consentAccepted));
      payload.append("whatsapp_opt_in", String(whatsappOptIn));
      if (foto) payload.append("foto", foto);
      const response = await fetch("/api/membros/pre-cadastro", { method: "POST", body: payload });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar seus dados.");
      setModal({ isOpen: true, type: "success", title: "Recebido!", message: result.message || "Seu cadastro foi recebido e está aguardando aprovação da igreja." });
      setFormData(DADOS_INICIAIS);
      setIsOutroCargo(false);
      setOutroCargo("");
      setConsentAccepted(false);
      setWhatsappOptIn(false);
      setSenha("");
      setConfirmarSenha("");
      setFoto(null);
      setActiveTab("pessoais");
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível enviar seus dados. Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  const invalid = (campo: string) => erro?.campo === campo;

  return (
    <main className={`${styles.viewport} bg-ohel-glow`}>
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className={styles.container}>
        <header className="flex shrink-0 items-center gap-3">
          <Logo className="h-10 w-16 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">Bem-vindo à Igreja</h1>
            <p className="text-xs text-gray-400">Preencha seu pré-cadastro em 3 etapas.</p>
          </div>
        </header>
        <Card className={styles.card}>
          <nav aria-label="Etapas do pré-cadastro" className="grid shrink-0 grid-cols-3 border-b border-gray-800 bg-ohel-surface/50">
            {ETAPAS.map((etapa, posicao) => {
              const Icon = etapa.icone;
              return (
                <button key={etapa.id} type="button" aria-current={activeTab === etapa.id ? "step" : undefined} onClick={() => mudarEtapa(etapa.id)} disabled={loading} className={`flex min-w-0 flex-col items-center gap-1 border-b-2 px-1 py-2.5 text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:text-sm ${activeTab === etapa.id ? "border-ohel-blue bg-ohel-blue/5 text-ohel-blue" : "border-transparent text-gray-400 hover:text-white"}`}>
                  <Icon className="h-4 w-4 shrink-0" /><span>{posicao + 1}. {etapa.curto}</span>
                </button>
              );
            })}
          </nav>
          <form
            noValidate
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
              if (event.key === "Enter" && activeTab !== "adicionais" && event.target instanceof HTMLInputElement && !["checkbox", "file", "date"].includes(event.target.type)) {
                event.preventDefault();
                prosseguir();
              }
            }}
            className={styles.form}
            aria-busy={loading}
          >
            <div ref={fieldsRef} className={styles.fields}>
              <h2 tabIndex={-1} className="mb-3 text-sm font-semibold text-white outline-none">{ETAPAS[indice].titulo}</h2>
              {erro && <p role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">{erro.mensagem}</p>}
              <fieldset disabled={loading} className="min-w-0 border-0 p-0">
                {activeTab === "pessoais" && (
                  <div className="flex flex-col gap-4">
                    <Input label="Nome Completo *" name="nome" value={formData.nome} onChange={handleChange} aria-invalid={invalid("nome")} autoComplete="name" required placeholder="Seu nome" />
                    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Data de Nascimento" type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} autoComplete="bday" />
                      <div className="flex min-w-0 flex-col gap-2">
                        <label htmlFor="sexo" className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">Sexo</label>
                        <select id="sexo" name="sexo" value={formData.sexo} onChange={handleChange} className="input-ohel w-full rounded-lg px-4 py-3">
                          <option value="">Selecione...</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option>
                        </select>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <label htmlFor="estado_civil" className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">Estado Civil</label>
                        <select id="estado_civil" name="estado_civil" value={formData.estado_civil} onChange={handleChange} className="input-ohel w-full rounded-lg px-4 py-3">
                          <option value="">Selecione...</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option><option value="Viúvo(a)">Viúvo(a)</option>
                        </select>
                      </div>
                      <Input label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} inputMode="numeric" placeholder="000.000.000-00" />
                      <Input label="Telefone / WhatsApp *" type="tel" name="telefone" value={formData.telefone} onChange={handleChange} aria-invalid={invalid("telefone")} autoComplete="tel" required placeholder="(00) 00000-0000" />
                      <Input label="E-mail para acessar a Área do Membro *" type="email" name="email" value={formData.email} onChange={handleChange} aria-invalid={invalid("email")} autoComplete="email" placeholder="seu@email.com" required />
                      <Input label="Crie sua senha *" name="senha" type="password" value={senha} onChange={(event) => setSenha(event.target.value)} aria-invalid={invalid("senha")} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" minLength={8} required />
                      <Input label="Confirme sua senha *" name="confirmar_senha" type="password" value={confirmarSenha} onChange={(event) => setConfirmarSenha(event.target.value)} aria-invalid={invalid("confirmar_senha")} autoComplete="new-password" placeholder="Repita sua senha" minLength={8} required />
                      <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
                        <label htmlFor="foto" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ohel-silver"><Camera className="h-4 w-4 text-ohel-blue" /> Foto de perfil (opcional)</label>
                        <input id="foto" name="foto" type="file" accept="image/*" onChange={(event) => setFoto(event.target.files?.[0] || null)} aria-invalid={invalid("foto")} className="w-full min-w-0 rounded-lg border border-gray-700 bg-ohel-bg p-2 text-gray-300" />
                        <p className="break-all text-xs text-gray-400">{foto ? `Foto selecionada: ${foto.name}` : "Envie uma imagem de até 5 MB."}</p>
                      </div>
                      <label className="flex items-start gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-xs text-gray-300 sm:col-span-2">
                        <input name="whatsapp_opt_in" type="checkbox" checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-green-500" />
                        <span><MessageCircle className="mr-1 inline h-4 w-4 text-green-400" /> Autorizo receber pelo WhatsApp a confirmação da aprovação do meu cadastro e o link de acesso à Área do Membro.</span>
                      </label>
                    </div>
                  </div>
                )}
                {activeTab === "endereco" && (
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
                    <Input label="Logradouro (Rua/Av)" name="logradouro" value={formData.logradouro} onChange={handleChange} autoComplete="address-line1" placeholder="Rua Exemplo" />
                    <Input label="Número" name="numero" value={formData.numero} onChange={handleChange} placeholder="123" />
                    <Input label="Complemento" name="complemento" value={formData.complemento} onChange={handleChange} autoComplete="address-line2" placeholder="Apto, Bloco" />
                    <Input label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} placeholder="Centro" />
                    <Input label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} autoComplete="address-level2" placeholder="Sua Cidade" />
                    <div className="flex min-w-0 flex-col gap-2">
                      <label htmlFor="uf" className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">UF</label>
                      <select id="uf" name="uf" value={formData.uf} onChange={handleChange} autoComplete="address-level1" className="input-ohel w-full rounded-lg px-4 py-3">
                        <option value="">Selecione...</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {activeTab === "adicionais" && (
                  <div className="flex flex-col gap-4">
                    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Nome do Pai" name="nome_pai" value={formData.nome_pai} onChange={handleChange} placeholder="Nome do seu pai" />
                      <Input label="Nome da Mãe" name="nome_mae" value={formData.nome_mae} onChange={handleChange} placeholder="Nome da sua mãe" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      <label htmlFor="congregacao_id" className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">Como nos conheceu? (Congregação)</label>
                      <select id="congregacao_id" name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full rounded-lg px-4 py-3">
                        <option value="">Selecione (opcional)</option>{congregacoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      <label htmlFor="cargo" className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">Cargo eclesiástico</label>
                      <select id="cargo" name="cargo" value={isOutroCargo ? OUTRO_CARGO_VALUE : formData.cargo} onChange={handleCargoChange} aria-invalid={invalid("cargo")} className="input-ohel w-full rounded-lg px-4 py-3">
                        <option value="Membro">Não tenho cargo eclesiástico ainda</option>
                        {cargos.filter((cargo) => cargo.nome.trim() && cargo.nome.trim().toLowerCase() !== "membro").map((cargo) => <option key={cargo.id} value={cargo.nome}>{cargo.nome}</option>)}
                        <option value={OUTRO_CARGO_VALUE}>Outro cargo</option>
                      </select>
                      <p className="text-xs leading-relaxed text-gray-500">Selecione “Membro” se ainda não possui um cargo cadastrado.</p>
                      {isOutroCargo && <Input id="outro_cargo" label="Informe o cargo" name="outro_cargo" value={outroCargo} onChange={handleOutroCargoChange} aria-invalid={invalid("outro_cargo")} maxLength={80} placeholder="Digite o cargo eclesiástico" required />}
                    </div>
                    <p className="rounded-lg border border-ohel-blue/20 bg-ohel-blue/5 p-3 text-xs leading-relaxed text-gray-400 sm:col-span-2">A informação sobre cargo será conferida pela secretaria e não concede acesso administrativo.</p>
                    <div className="rounded-xl border border-gray-700/50 bg-ohel-bg/50 p-4">
                      <div className="mb-2 flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-ohel-blue" /><h3 className="text-xs font-bold text-white">Termo de Consentimento e Privacidade</h3></div>
                      <p className="mb-3 text-xs leading-relaxed text-gray-400">A proteção dos seus dados é uma prioridade. O <strong className="text-white">OHEL ON</strong> está em conformidade com a LGPD. Suas informações serão utilizadas exclusivamente para fins de organização interna. <a href="#" className="text-ohel-blue hover:underline">clique aqui</a> para ver o termo completo.</p>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input name="consent_accepted" type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} aria-invalid={invalid("consent_accepted")} className="mt-0.5 h-4 w-4 shrink-0 accent-ohel-blue" />
                        <span className="text-xs leading-relaxed text-gray-300">Estou de acordo com o tratamento de meus dados pessoais descritos na Política de Privacidade. *</span>
                      </label>
                    </div>
                  </div>
                )}
              </fieldset>
            </div>
            <footer className={styles.footer}>
              <p className="mb-2 text-xs text-gray-400">Etapa {indice + 1} de 3 <span className="text-gray-500">— {activeTab === "adicionais" ? "Revise e envie seus dados." : "Os dados serão enviados apenas ao finalizar."}</span></p>
              <div className="flex min-w-0 gap-2">
                {indice > 0 && <Button key="voltar" type="button" variant="secondary" disabled={loading} onClick={() => mudarEtapa(ETAPAS[indice - 1].id)} className="shrink-0"><ArrowLeft className="h-4 w-4 shrink-0" /> Voltar</Button>}
                {activeTab !== "adicionais" ? (
                  <Button key="prosseguir" type="button" disabled={loading} onClick={prosseguir} className="min-w-0 flex-1">Prosseguir <ArrowRight className="h-4 w-4 shrink-0" /></Button>
                ) : (
                  <Button key="finalizar" type="submit" disabled={loading} className="min-w-0 flex-1"><CheckCircle className="hidden h-4 w-4 shrink-0 sm:block" />{loading ? "Enviando..." : "Finalizar Pré-Cadastro"}</Button>
                )}
              </div>
            </footer>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function PreCadastroPage() {
  return <Suspense fallback={<main className={`${styles.viewport} bg-ohel-bg flex items-center justify-center text-white`}>Carregando formulário...</main>}><PreCadastroForm /></Suspense>;
}
