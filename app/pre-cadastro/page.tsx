"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { User, MapPin, Church, CheckCircle, ShieldCheck } from "lucide-react";

function PreCadastroForm() {
  const searchParams = useSearchParams();
  const igrejaId = searchParams.get("igreja");

  const [activeTab, setActiveTab] = useState("pessoais");
  const [loading, setLoading] = useState(false);
  const [congregacoes, setCongregacoes] = useState<{id: string, nome: string}[]>([]);
  const [erroCongregacoes, setErroCongregacoes] = useState("");
  const [formError, setFormError] = useState("");
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error" | "warning", title: "", message: "" });
  
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [formData, setFormData] = useState({
    nome: "", data_nascimento: "", sexo: "", estado_civil: "", cpf: "", email: "", telefone: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    congregacao_id: "", nome_pai: "", nome_mae: ""
  });

  useEffect(() => {
    const fetchCongregacoes = async () => {
      if (!igrejaId) return;
      const { data, error } = await supabase.from('congregacoes').select('id, nome').eq('igreja_id', igrejaId).order('nome');
      if (error) {
        console.error("Falha ao carregar congregações do pré-cadastro:", error);
        setErroCongregacoes("Não foi possível carregar as congregações. Você ainda pode enviar o pré-cadastro sem selecionar uma.");
        return;
      }
      setCongregacoes(data ?? []);
      setErroCongregacoes("");
    };
    fetchCongregacoes();
  }, [igrejaId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError("");
  };

  const avancarEtapa = () => {
    if (activeTab === "pessoais") {
      if (!formData.nome.trim()) {
        setFormError("Informe seu nome completo para continuar.");
        return;
      }
      if (!formData.telefone.trim()) {
        setFormError("Informe seu telefone ou WhatsApp para continuar.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        setFormError("Informe um e-mail válido para continuar.");
        return;
      }
      setActiveTab("endereco");
    } else if (activeTab === "endereco") {
      setActiveTab("adicionais");
    }
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const voltarEtapa = () => {
    setActiveTab(activeTab === "adicionais" ? "endereco" : "pessoais");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Link de pré-cadastro inválido." });
    if (!formData.nome.trim() || !formData.telefone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setFormError("Confira nome, telefone e e-mail. Esses dados são obrigatórios.");
      setActiveTab("pessoais");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!consentAccepted) return setModal({ isOpen: true, type: "warning", title: "Atenção", message: "Para prosseguir, você precisa aceitar o Termo de Consentimento e Privacidade." });
    
    setLoading(true);
    try {
      const { error } = await supabase.from("membros").insert([{
        igreja_id: igrejaId,
        nome: formData.nome,
        data_nascimento: formData.data_nascimento || null,
        sexo: formData.sexo,
        estado_civil: formData.estado_civil,
        cpf: formData.cpf,
        email: formData.email.trim().toLowerCase(),
        telefone: formData.telefone,
        cep: formData.cep,
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        uf: formData.uf,
        congregacao_id: formData.congregacao_id || null,
        nome_pai: formData.nome_pai,
        nome_mae: formData.nome_mae,
        status: "Pré-Cadastro"
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Recebido!", message: "Seus dados foram enviados com sucesso. Aguarde o contato da secretaria da igreja." });
      
      setFormData({
        nome: "", data_nascimento: "", sexo: "", estado_civil: "", cpf: "", email: "", telefone: "",
        cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
        congregacao_id: "", nome_pai: "", nome_mae: ""
      });
      setConsentAccepted(false);
      setActiveTab("pessoais");
      setFormError("");
    } catch {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível enviar seus dados. Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[100dvh] bg-ohel-glow py-5 px-3 sm:px-4 md:py-8 flex flex-col items-center justify-start">
      
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      
      <div className="mb-4 scale-75">
        <Logo />
      </div>

      <div className="w-full max-w-2xl mb-6 text-center">
        <h1 className="text-xl font-bold text-white tracking-tight">Bem-vindo à Igreja</h1>
        <p className="text-gray-400 text-xs mt-1">Preencha seus dados para nos conhecermos melhor.</p>
      </div>

      {/* Card Principal (Agora com max-w-2xl e sem altura mínima) */}
      <Card className="w-full max-w-2xl p-0 overflow-visible border-gray-800 shadow-2xl flex flex-col">
        
        {/* Menu de Abas */}
        <div className="flex border-b border-gray-800 bg-ohel-surface/50 overflow-x-auto shrink-0">
          <button type="button" onClick={() => setActiveTab("pessoais")} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "pessoais" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <User className="w-4 h-4" /> Dados Pessoais
          </button>
          <button type="button" onClick={() => setActiveTab("endereco")} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "endereco" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <MapPin className="w-4 h-4" /> Endereço
          </button>
          <button type="button" onClick={() => setActiveTab("adicionais")} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "adicionais" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <Church className="w-4 h-4" /> Informações Adicionais
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          
          {formError && <p role="alert" className="mx-5 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 md:mx-6">{formError}</p>}
          <div className="p-5 pb-4 md:p-6 md:pb-4">
            {activeTab === "pessoais" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Input label="Nome Completo *" name="nome" value={formData.nome} onChange={handleChange} required placeholder="Seu nome" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Data de Nascimento" type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} />
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Sexo</label>
                    <select name="sexo" value={formData.sexo} onChange={handleChange} className="input-ohel w-full px-4 py-2.5 rounded-lg text-sm">
                      <option value="">Selecione...</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Estado Civil</label>
                    <select name="estado_civil" value={formData.estado_civil} onChange={handleChange} className="input-ohel w-full px-4 py-2.5 rounded-lg text-sm">
                      <option value="">Selecione...</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                    </select>
                  </div>
                  <Input label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" />
                  <Input label="Telefone / WhatsApp *" name="telefone" value={formData.telefone} onChange={handleChange} required placeholder="(00) 00000-0000" />
                  <div className="md:col-span-2">
                    <Input label="E-mail *" type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="seu@email.com" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "endereco" && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" />
                <div className="md:col-span-3">
                  <Input label="Logradouro (Rua/Av)" name="logradouro" value={formData.logradouro} onChange={handleChange} placeholder="Rua Exemplo" />
                </div>
                <Input label="Número" name="numero" value={formData.numero} onChange={handleChange} placeholder="123" />
                <Input label="Complemento" name="complemento" value={formData.complemento} onChange={handleChange} placeholder="Apto, Bloco" />
                <Input label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} placeholder="Centro" className="md:col-span-2" />
                <Input label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} placeholder="Sua Cidade" className="md:col-span-3" />
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">UF</label>
                  <select name="uf" value={formData.uf} onChange={handleChange} className="input-ohel w-full px-4 py-2.5 rounded-lg text-sm">
                    <option value="">UF</option>
                    <option value="RJ">RJ</option>
                    <option value="SP">SP</option>
                    <option value="MG">MG</option>
                    <option value="ES">ES</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === "adicionais" && (
              <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nome do Pai" name="nome_pai" value={formData.nome_pai} onChange={handleChange} placeholder="Nome do seu pai" />
                  <Input label="Nome da Mãe" name="nome_mae" value={formData.nome_mae} onChange={handleChange} placeholder="Nome da sua mãe" />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Como nos conheceu? (Congregação)</label>
                  <select name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full px-4 py-2.5 rounded-lg text-sm">
                    <option value="">Selecione (opcional)</option>
                    {congregacoes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  {erroCongregacoes ? (
                    <p role="status" className="text-xs text-amber-300">{erroCongregacoes}</p>
                  ) : congregacoes.length === 0 ? (
                    <p className="text-xs text-gray-500">Nenhuma congregação cadastrada. Você pode continuar sem selecionar uma.</p>
                  ) : null}
                </div>

                {/* TERMO DE CONSENTIMENTO (Apenas na última aba) */}
                <div className="bg-ohel-bg/50 border border-gray-700/50 rounded-xl p-4 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-ohel-blue" />
                    <h3 className="text-xs font-bold text-white">Termo de Consentimento e Privacidade</h3>
                  </div>
                  
                  <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                    A proteção dos seus dados é uma prioridade. O <strong className="text-white">OHEL ON</strong> está em conformidade com a LGPD. Suas informações serão utilizadas exclusivamente para fins de organização interna. <a href="#" className="text-ohel-blue hover:underline">clique aqui</a> para ver o termo completo.
                  </p>

                  <label className="flex items-start gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input 
                        type="checkbox" 
                        checked={consentAccepted}
                        onChange={(e) => setConsentAccepted(e.target.checked)}
                        className="peer appearance-none w-4 h-4 border-2 border-gray-500 rounded bg-transparent checked:bg-ohel-blue checked:border-ohel-blue transition-all cursor-pointer"
                      />
                      <CheckCircle className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                    </div>
                    <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors select-none leading-tight">
                      Estou de acordo com o tratamento de meus dados pessoais descritos na Política de Privacidade. *
                    </span>
                  </label>
                </div>

              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-gray-800 bg-ohel-surface/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:px-6">
            {activeTab === "pessoais" ? (
              <>
                <span className="text-[11px] text-gray-500">Etapa 1 de 3</span>
                <Button type="button" onClick={avancarEtapa} className="min-h-11 px-5">Próximo</Button>
              </>
            ) : activeTab === "endereco" ? (
              <>
                <Button type="button" variant="secondary" onClick={voltarEtapa} className="min-h-11 px-4">Voltar</Button>
                <span className="text-[11px] text-gray-500">Etapa 2 de 3</span>
                <Button type="button" onClick={avancarEtapa} className="min-h-11 px-5">Próximo</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={voltarEtapa} className="min-h-11 px-4">Voltar</Button>
                <span className="text-[11px] text-gray-500">Etapa 3 de 3</span>
                <Button type="submit" disabled={loading} className="min-h-11 px-4 text-xs sm:px-5 sm:text-sm">
                  <CheckCircle className="h-4 w-4" />
                  {loading ? "Enviando..." : "Enviar pré-cadastro"}
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function PreCadastroPage() {
  return (
    <Suspense fallback={<div className="w-full h-screen flex items-center justify-center bg-ohel-bg text-white">Carregando formulário...</div>}>
      <PreCadastroForm />
    </Suspense>
  );
}