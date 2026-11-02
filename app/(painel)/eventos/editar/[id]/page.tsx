"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, Calendar, MapPin, Upload, Loader2, Image as ImageIcon, Megaphone, CheckCircle, Download, Trash2, Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function EditarEventoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState("dados");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [congregacoes, setCongregacoes] = useState<{id: string, nome: string}[]>([]);
  const [enderecoIgreja, setEnderecoIgreja] = useState("");
  const [galeriaUploading, setGaleriaUploading] = useState(false);
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", descricao: "", congregacao_id: "", data_inicio: "", data_fim: "", hora_abertura: "",
    data_limite_inscricao: "", limite_participantes: "", cartaz_url: "",
    usar_endereco_igreja: false, preco_ingresso: "", pregador_convidados: "", informacoes_adicionais: "", galeria_urls: [] as string[],
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    status: "Aberto", publicar_mural: false,
    tipo: "evento",
    valor_bilhete: "10",
    total_numeros: "100",
    numero_inicial: "1",
    data_sorteio: ""
  });

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      try {
        const { data: congs } = await supabase.from('congregacoes').select('id, nome').order('nome');
        if (congs) setCongregacoes(congs);

        const { data, error } = await supabase.from('eventos').select('*').eq('id', id).single();
        if (error) throw error;

        if (data) {
          const { data: igreja } = await supabase.from('igrejas').select('endereco').eq('id', data.igreja_id).maybeSingle();
          setEnderecoIgreja(igreja?.endereco || '');
          setFormData({
            nome: data.nome || "", descricao: data.descricao || "", congregacao_id: data.congregacao_id || "",
            data_inicio: data.data_inicio || "", data_fim: data.data_fim || "", hora_abertura: data.hora_abertura || "",
            data_limite_inscricao: data.data_limite_inscricao || "", limite_participantes: data.limite_participantes?.toString() || "",
            cartaz_url: data.cartaz_url || "", cep: data.cep || "", logradouro: data.logradouro || "",
            numero: data.numero || "", complemento: data.complemento || "", bairro: data.bairro || "",
            cidade: data.cidade || "", uf: data.uf || "", status: data.status || "Aberto",
            publicar_mural: data.publicar_mural || false,
            usar_endereco_igreja: data.usar_endereco_igreja || false,
            preco_ingresso: data.preco_ingresso?.toString() || "",
            pregador_convidados: data.pregador_convidados || "",
            informacoes_adicionais: data.informacoes_adicionais || "",
            galeria_urls: data.galeria_urls || [],
            tipo: data.tipo || "evento",
            valor_bilhete: data.valor_bilhete?.toString() || "10",
            total_numeros: data.total_numeros?.toString() || "100",
            numero_inicial: data.numero_inicial?.toString() || "1",
            data_sorteio: data.data_sorteio || ""
          });
        }
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar os dados do evento." });
      } finally {
        setLoading(false);
      }
    };
    fetchDados();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const consultarCep = async () => {
    const cep = formData.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado");
      setFormData((prev) => ({ ...prev, cep, logradouro: data.logradouro || prev.logradouro, bairro: data.bairro || prev.bairro, cidade: data.localidade || prev.cidade, uf: data.uf || prev.uf }));
    } catch { setModal({ isOpen: true, type: "error", title: "CEP não encontrado", message: "Confira o CEP informado e tente novamente." }); }
  };
  const uploadArquivo = async (file: File) => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `evento-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const { error } = await supabase.storage.from('cartazes').upload(fileName, file);
    if (error) throw error;
    return supabase.storage.from('cartazes').getPublicUrl(fileName).data.publicUrl;
  };
  const handleUploadCartaz = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { setUploading(true); const url = await uploadArquivo(file); setFormData((prev) => ({ ...prev, cartaz_url: url })); }
    catch { setModal({ isOpen: true, type: "error", title: "Erro no Upload", message: "Não foi possível enviar a imagem do cartaz." }); }
    finally { setUploading(false); e.target.value = ""; }
  };
  const handleUploadGaleria = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    try { setGaleriaUploading(true); const urls = await Promise.all(files.map(uploadArquivo)); setFormData((prev) => ({ ...prev, galeria_urls: [...prev.galeria_urls, ...urls] })); }
    catch { setModal({ isOpen: true, type: "error", title: "Erro na galeria", message: "Não foi possível enviar uma ou mais fotos." }); }
    finally { setGaleriaUploading(false); e.target.value = ""; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (formData.tipo === "sorteio") {
        const payload = {
          nome: formData.nome,
          descricao: formData.descricao,
          tipo: "sorteio",
          valor_bilhete: Number(formData.valor_bilhete || 0),
          total_numeros: Number(formData.total_numeros || 100),
          numero_inicial: Number(formData.numero_inicial || 1),
          data_sorteio: formData.data_sorteio || null,
          cartaz_url: formData.cartaz_url || null,
          status: formData.status === "Aberto" ? "ativo" : formData.status.toLowerCase(),
        };

        const { error } = await supabase.from("sorteios").update(payload).eq("id", id);
        if (error) throw new Error("Tabela de sorteios não encontrada. Execute o SQL do módulo de sorteios antes de editar a rifa.");

        setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Sorteio atualizado com sucesso!" });
        return;
      }

      const payload = {
        nome: formData.nome, descricao: formData.descricao, congregacao_id: formData.congregacao_id || null,
        data_inicio: formData.data_inicio, data_fim: formData.data_fim || null, hora_abertura: formData.hora_abertura || null,
        data_limite_inscricao: formData.data_limite_inscricao || null,
        limite_participantes: formData.limite_participantes ? parseInt(formData.limite_participantes) : null,
        cartaz_url: formData.cartaz_url || null, galeria_urls: formData.galeria_urls,
        preco_ingresso: formData.preco_ingresso ? Number(formData.preco_ingresso) : null,
        pregador_convidados: formData.pregador_convidados || null, informacoes_adicionais: formData.informacoes_adicionais || null,
        usar_endereco_igreja: formData.usar_endereco_igreja,
        cep: formData.usar_endereco_igreja ? null : (formData.cep || null), logradouro: formData.usar_endereco_igreja ? null : (formData.logradouro || null), numero: formData.usar_endereco_igreja ? null : (formData.numero || null),
        complemento: formData.usar_endereco_igreja ? null : (formData.complemento || null), bairro: formData.usar_endereco_igreja ? null : (formData.bairro || null), cidade: formData.usar_endereco_igreja ? null : (formData.cidade || null), uf: formData.usar_endereco_igreja ? null : (formData.uf || null),
        status: formData.status, publicar_mural: formData.publicar_mural
      };
      const { error } = await supabase.from("eventos").update(payload).eq("id", id);
      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Evento atualizado com sucesso!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Atualizar", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === "success") router.push("/eventos");
  };

  if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-400">Carregando dados do evento...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/eventos" className="text-gray-400 hover:text-white transition-colors mt-1"><ArrowLeft className="w-6 h-6" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editar Evento</h1>
            <p className="text-gray-400 text-sm mt-1">Atualize as informações, datas e local deste evento.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving || uploading} className="w-full md:w-auto px-8 shrink-0">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <Card className="p-0 overflow-hidden border-gray-800">
        <div className="flex border-b border-gray-800 bg-ohel-surface/50 overflow-x-auto">
          <button type="button" onClick={() => setActiveTab("dados")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "dados" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}><Calendar className="w-4 h-4" /> Dados do Evento</button>
          <button type="button" onClick={() => setActiveTab("local")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "local" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}><MapPin className="w-4 h-4" /> Local e Cartaz</button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {activeTab === "dados" && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2"><Input label="Nome do Evento *" name="nome" value={formData.nome} onChange={handleChange} required /></div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Status do Evento</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="Aberto">Aberto (Inscrições Abertas)</option><option value="Encerrado">Encerrado</option><option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Tipo de cadastro</label>
                  <select name="tipo" value={formData.tipo} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="evento">Evento</option>
                    <option value="sorteio">Sorteio</option>
                  </select>
                </div>
                {formData.tipo === "sorteio" ? (
                  <Input label="Valor do bilhete" type="number" min="0" step="0.01" name="valor_bilhete" value={formData.valor_bilhete} onChange={handleChange} />
                ) : (
                  <Input label="Hora Abertura" type="time" name="hora_abertura" value={formData.hora_abertura} onChange={handleChange} />
                )}
              </div>

              {formData.tipo === "sorteio" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border border-violet-500/20 rounded-xl bg-violet-500/5 p-4">
                  <Input label="Total de números" type="number" min="1" name="total_numeros" value={formData.total_numeros} onChange={handleChange} />
                  <Input label="Número inicial" type="number" min="1" name="numero_inicial" value={formData.numero_inicial} onChange={handleChange} />
                  <Input label="Data do sorteio" type="date" name="data_sorteio" value={formData.data_sorteio} onChange={handleChange} />
                </div>
              )}

              {/* CHECKBOX NO TOPO */}
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" name="publicar_mural" checked={formData.publicar_mural} onChange={handleChange} className="peer appearance-none w-6 h-6 border-2 border-gray-500 rounded bg-transparent checked:bg-ohel-blue checked:border-ohel-blue transition-all cursor-pointer" />
                    <CheckCircle className="w-4 h-4 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-ohel-blue transition-colors flex items-center gap-2"><Megaphone className="w-4 h-4 text-purple-400" /> Publicar no Mural de Comunicações</p>
                    <p className="text-[11px] text-gray-400">O cartaz deste evento aparecerá em destaque no mural da igreja.</p>
                  </div>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Descrição (Opcional)</label>
                <textarea name="descricao" value={formData.descricao} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[100px] resize-y" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input label="Preço do ingresso (R$)" type="number" min="0" step="0.01" name="preco_ingresso" placeholder="Deixe vazio se for gratuito" value={formData.preco_ingresso} onChange={handleChange} />
                <Input label="Pregador(es) / Convidado(s)" name="pregador_convidados" placeholder="Ex.: Pr. João e Banda Vida" value={formData.pregador_convidados} onChange={handleChange} />
              </div>
              <div className="flex flex-col gap-2"><label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Informações adicionais</label><textarea name="informacoes_adicionais" value={formData.informacoes_adicionais} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[80px] resize-y" /></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Congregação</label>
                  <select name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="">Todas as Congregações / Geral</option>
                    {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-gray-800 pt-5 mt-2">
                <Input label="Data de Início *" type="date" name="data_inicio" value={formData.data_inicio} onChange={handleChange} required />
                <Input label="Data de Término" type="date" name="data_fim" value={formData.data_fim} onChange={handleChange} />
                <Input label="Limite de Inscrição" type="date" name="data_limite_inscricao" value={formData.data_limite_inscricao} onChange={handleChange} />
              </div>

              <div className="md:w-1/2">
                <Input label="Quantidade Limite de Pessoas" type="number" name="limite_participantes" value={formData.limite_participantes} onChange={handleChange} />
              </div>
            </div>
          )}

          {activeTab === "local" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Cartaz do Evento</label>
                  <span className="text-[10px] text-gray-500">Imagem ou PDF (máx 2MB)</span>
                </div>
                <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 bg-ohel-bg border-2 border-dashed border-gray-700 hover:border-ohel-blue rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group">
                  {formData.cartaz_url ? (
                    <>
                      <Image src={formData.cartaz_url} alt="Cartaz" fill className="object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                      <div className="z-10 flex items-center gap-2"><span className="bg-black/60 p-2 rounded-lg flex items-center gap-2 text-white text-xs font-bold backdrop-blur-md"><ImageIcon className="w-4 h-4" /> Trocar Imagem</span><a href={formData.cartaz_url} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="bg-black/70 p-2 rounded-lg text-white" title="Baixar capa"><Download className="w-4 h-4" /></a></div>
                    </>
                  ) : (
                    <><Upload className="w-8 h-8 text-gray-500 mb-2 group-hover:text-ohel-blue transition-colors" /><p className="text-sm font-medium text-white">Clique para anexar o Cartaz</p></>
                  )}
                  {uploading && <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20"><Loader2 className="w-6 h-6 text-ohel-blue animate-spin" /></div>}
                </div>
                <input type="file" accept="image/*, application/pdf" ref={fileInputRef} onChange={handleUploadCartaz} className="hidden" />
              </div>

              <div className="border-t border-gray-800 pt-5 mt-2">
                <div className="flex items-center justify-between gap-3 mb-4"><h3 className="text-sm font-semibold text-white">Endereço do Evento</h3><label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer"><input type="checkbox" name="usar_endereco_igreja" checked={formData.usar_endereco_igreja} onChange={handleChange} /> Usar endereço da igreja</label></div>
                <div className={`grid grid-cols-1 md:grid-cols-4 gap-5 ${formData.usar_endereco_igreja ? "opacity-50" : ""}`}>
                  <div className="relative"><Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} onBlur={consultarCep} disabled={formData.usar_endereco_igreja} /><button type="button" onClick={consultarCep} className="absolute right-2 bottom-2 p-2 text-ohel-blue" title="Buscar CEP" disabled={formData.usar_endereco_igreja}><Search className="w-4 h-4" /></button></div>
                  <div className="md:col-span-3"><Input label="Logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} /></div>
                  <Input label="Número" name="numero" value={formData.numero} onChange={handleChange} />
                  <Input label="Complemento" name="complemento" value={formData.complemento} onChange={handleChange} />
                  <Input label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} className="md:col-span-2" />
                  <Input label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} className="md:col-span-3" />
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">UF</label>
                    <select name="uf" value={formData.uf} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                      <option value="">UF</option><option value="RJ">RJ</option><option value="SP">SP</option><option value="MG">MG</option><option value="ES">ES</option>
                    </select>
                  </div>
                </div>
              </div>
              {formData.usar_endereco_igreja && <p className="text-xs text-ohel-blue">Endereço cadastrado: {enderecoIgreja || "não informado nas configurações da igreja"}</p>}
              <div className="border-t border-gray-800 pt-5 mt-2"><div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-semibold text-white">Fotos adicionais</h3><p className="text-xs text-gray-500">Além da capa, anexe fotos da programação e do local.</p></div><label className="cursor-pointer text-xs bg-ohel-blue/20 text-ohel-blue px-3 py-2 rounded-lg hover:bg-ohel-blue hover:text-white">{galeriaUploading ? "Enviando..." : "Adicionar fotos"}<input type="file" accept="image/*" multiple onChange={handleUploadGaleria} className="hidden" /></label></div>{formData.galeria_urls.length > 0 && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{formData.galeria_urls.map((url, index) => <div key={url} className="relative aspect-video rounded-lg overflow-hidden border border-gray-700"><Image src={url} alt={`Foto ${index + 1}`} fill sizes="200px" className="object-cover" /><div className="absolute inset-x-1 bottom-1 flex justify-between"><a href={url} download target="_blank" rel="noreferrer" className="p-1.5 rounded bg-black/70 text-white" title="Baixar"><Download className="w-3 h-3" /></a><button type="button" onClick={() => setFormData((prev) => ({ ...prev, galeria_urls: prev.galeria_urls.filter((_, i) => i !== index) }))} className="p-1.5 rounded bg-red-600/80 text-white" title="Remover"><Trash2 className="w-3 h-3" /></button></div></div>)}</div>}</div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}