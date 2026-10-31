"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, FileText, CalendarDays, Tag, AlignLeft } from "lucide-react";
import Link from "next/link";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

// Tipagens para resolver os erros de ESLint (any)
interface Fornecedor { id: string; razao_social: string; }
interface Categoria { id: string; nome: string; }
interface Caixa { id: string; nome: string; }
interface FormaPagamento { id: string; nome: string; }
interface Congregacao { id: string; nome: string; }

export default function EditarContaPagarPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string; // Pega o ID da URL

  const [loading, setLoading] = useState(true); // Loading inicial da tela
  const [saving, setSaving] = useState(false); // Loading do botão salvar
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // Listas
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);

  const [formData, setFormData] = useState({
    descricao: "",
    tipo_conta: "Única",
    fornecedor_id: "",
    numero_documento: "",
    valor: "",
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: "",
    dia_vencimento_mensal: "",
    total_parcelas: "1",
    categoria_id: "",
    caixa_id: "",
    forma_pagamento_id: "",
    congregacao_id: "",
    observacoes: ""
  });

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (!user) return;

        setIgrejaId(user.igreja_id);

        // Busca as listas e os dados da conta em paralelo
        const [forn, cat, cx, frm, cong, contaRes] = await Promise.all([
          supabase.from('fornecedores').select('id, razao_social').eq('igreja_id', user.igreja_id).order('razao_social'),
          supabase.from('categorias_financeiras').select('*').eq('igreja_id', user.igreja_id).eq('tipo', 'Despesa'),
          supabase.from('caixas').select('*').eq('igreja_id', user.igreja_id),
          supabase.from('formas_pagamento').select('*').eq('igreja_id', user.igreja_id),
          supabase.from('congregacoes').select('*').eq('igreja_id', user.igreja_id),
          supabase.from('contas_pagar').select('*').eq('id', id).eq('igreja_id', user.igreja_id).single()
        ]);

        if (forn.data) setFornecedores(forn.data);
        if (cat.data) setCategorias(cat.data);
        if (cx.data) setCaixas(cx.data);
        if (frm.data) setFormas(frm.data);
        if (cong.data) setCongregacoes(cong.data);

        // Popula o formulário com os dados da conta
        if (contaRes.data) {
          const c = contaRes.data;
          setFormData({
            descricao: c.descricao || "",
            tipo_conta: c.recorrente ? "Recorrente" : c.total_parcelas > 1 ? "Parcelada" : "Única",
            fornecedor_id: c.fornecedor_id || "",
            numero_documento: c.numero_documento || "",
            // Formata o valor para o input (ex: 1500.50 -> 1500,50)
            valor: formatCurrencyInput(String(Math.round(Number(c.valor) * 100))),
            data_emissao: c.data_emissao || "",
            data_vencimento: c.data_vencimento || "",
            dia_vencimento_mensal: c.dia_vencimento_mensal?.toString() || "",
            total_parcelas: c.total_parcelas?.toString() || "1",
            categoria_id: c.categoria_id || "",
            caixa_id: c.caixa_id || "",
            forma_pagamento_id: c.forma_pagamento_id || "",
            congregacao_id: c.congregacao_id || "",
            observacoes: c.observacoes || ""
          });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Erro ao carregar os dados.";
        setModal({ isOpen: true, type: "error", title: "Erro", message: msg });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === "tipo_conta" && value === "Única" ? { total_parcelas: "1", dia_vencimento_mensal: "" } : {}),
      ...(name === "tipo_conta" && value === "Recorrente" ? { total_parcelas: "1" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada. Entre novamente no sistema." });
      return;
    }

    const valorParcela = parseCurrencyInput(formData.valor);
    if (!Number.isFinite(valorParcela) || valorParcela <= 0) {
      setModal({ isOpen: true, type: "error", title: "Valor inválido", message: "Informe um valor maior que zero." });
      return;
    }
    setSaving(true);

    try {
      const qtdParcelas = formData.tipo_conta === "Parcelada" ? parseInt(formData.total_parcelas, 10) : 1;
      if (!Number.isInteger(qtdParcelas) || qtdParcelas < 1 || qtdParcelas > 120) {
        throw new Error("Informe uma quantidade de parcelas entre 1 e 120.");
      }

      const { data, error } = await supabase.from('contas_pagar').update({
        fornecedor_id: formData.fornecedor_id || null,
        descricao: formData.descricao,
        numero_documento: formData.numero_documento,
        tipo_conta: formData.tipo_conta,
        total_parcelas: qtdParcelas,
        valor: valorParcela,
        recorrente: formData.tipo_conta === "Recorrente",
        data_emissao: formData.data_emissao || null,
        data_vencimento: formData.data_vencimento,
        dia_vencimento_mensal: formData.dia_vencimento_mensal ? parseInt(formData.dia_vencimento_mensal) : null,
        categoria_id: formData.categoria_id || null,
        caixa_id: formData.caixa_id || null,
        forma_pagamento_id: formData.forma_pagamento_id || null,
        congregacao_id: formData.congregacao_id || null,
        observacoes: formData.observacoes,
      }).eq('id', id).eq('igreja_id', igrejaId).select("id").maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Conta não encontrada ou sem permissão para atualizar.");

      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Conta atualizada com sucesso!" });
      setTimeout(() => router.push("/financeiro/contas-pagar"), 1500);

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao atualizar a conta";
      setModal({ isOpen: true, type: "error", title: "Erro", message: msg });
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-400">Carregando dados da conta...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center gap-3">
        <Link href="/financeiro/contas-pagar" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-ohel-blue" /> Editar Conta a Pagar
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Atualize as informações da conta a pagar selecionada.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* CARD 1: DADOS DA CONTA */}
        <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
            <FileText className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">Dados da Conta / Compromisso</h2>
          </div>
          
          <div>
            <Input label="Descrição da Conta / Despesa *" name="descricao" value={formData.descricao} onChange={handleChange} required className="py-2 text-xs" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase">Tipo de Conta *</label>
              <select name="tipo_conta" value={formData.tipo_conta} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="Única">Única (À vista / 1 Parcela)</option>
                <option value="Parcelada">Parcelada</option>
                <option value="Recorrente">Recorrente (Mensal)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase">Fornecedor (Opcional)</label>
              <select name="fornecedor_id" value={formData.fornecedor_id} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Selecione o Fornecedor...</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razao_social}</option>)}
              </select>
            </div>
            <Input label="Nº do Documento / Nota Fiscal / Boleto" name="numero_documento" value={formData.numero_documento} onChange={handleChange} className="py-2 text-xs" />
            <CurrencyInput label="Valor da Conta (R$) *" name="valor" value={formData.valor} onChange={(value) => setFormData((current) => ({ ...current, valor: value }))} required className="py-2 text-xs" />
            <Input label="Data de Emissão" type="date" name="data_emissao" value={formData.data_emissao} onChange={handleChange} className="py-2 text-xs" />
          </div>
        </Card>

        {/* CARD 2: CONDIÇÕES DE VENCIMENTO */}
        <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
            <CalendarDays className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">Condições de Vencimento e Parcelas</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Data de Vencimento *" type="date" name="data_vencimento" value={formData.data_vencimento} onChange={handleChange} required className="py-2 text-xs" />
            
            {formData.tipo_conta !== 'Única' && (
              <>
                <Input label="Dia de Vencimento Mensal" type="number" name="dia_vencimento_mensal" min="1" max="31" value={formData.dia_vencimento_mensal} onChange={handleChange} className="py-2 text-xs" />
                {formData.tipo_conta === "Parcelada" ? (
                  <Input label="Quantidade de Parcelas *" type="number" name="total_parcelas" min="2" max="120" value={formData.total_parcelas} onChange={handleChange} required className="py-2 text-xs" />
                ) : (
                  <p className="md:col-span-2 self-center text-xs text-gray-400">
                    Ao dar baixa, o próximo mês será criado e o valor poderá ser ajustado.
                  </p>
                )}
              </>
            )}
          </div>
        </Card>

        {/* CARD 3: CLASSIFICAÇÃO */}
        <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
            <Tag className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">Classificação e Destino</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase">Categoria Financeira</label>
              <select name="categoria_id" value={formData.categoria_id} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Selecione a Categoria...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase">Caixa / Conta Pagadora Prevista</label>
              <select name="caixa_id" value={formData.caixa_id} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Selecione o Caixa/Banco...</option>
                {caixas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase">Forma de Pagamento Prevista</label>
              <select name="forma_pagamento_id" value={formData.forma_pagamento_id} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Selecione a Forma de Pagamento...</option>
                {formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase">Congregação</label>
              <select name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Sede / Principal</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* CARD 4: OBSERVAÇÕES */}
        <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
            <AlignLeft className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">Observações Adicionais</h2>
          </div>
          <textarea 
            name="observacoes" 
            value={formData.observacoes} 
            onChange={handleChange}
            className="input-ohel w-full px-4 py-3 rounded-lg text-xs min-h-[100px] resize-y"
          />
        </Card>

        {/* BOTOES */}
        <div className="flex justify-end gap-3 mt-2">
          <Link href="/financeiro/contas-pagar" className="px-6 py-2.5 text-xs font-medium text-gray-400 hover:text-white transition-colors">
            Cancelar
          </Link>
          <Button type="submit" variant="primary" disabled={saving} className="w-auto px-8 py-2.5 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Atualizando..." : "Salvar Alterações"}
          </Button>
        </div>

      </form>
    </div>
  );
}