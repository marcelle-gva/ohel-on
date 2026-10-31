"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, FileText, CalendarDays, Tag, AlignLeft } from "lucide-react";
import Link from "next/link";
import { parseCurrencyInput } from "@/lib/currency";
import { getMonthlyDate } from "@/lib/monthlyDate";

export default function NovaContaPagarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // Listas
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [caixas, setCaixas] = useState<any[]>([]);
  const [formas, setFormas] = useState<any[]>([]);
  const [congregacoes, setCongregacoes] = useState<any[]>([]);

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          const [forn, cat, cx, frm, cong] = await Promise.all([
            supabase.from('fornecedores').select('id, razao_social').eq('igreja_id', user.igreja_id).order('razao_social'),
            supabase.from('categorias_financeiras').select('*').eq('igreja_id', user.igreja_id).eq('tipo', 'Despesa'),
            supabase.from('caixas').select('*').eq('igreja_id', user.igreja_id),
            supabase.from('formas_pagamento').select('*').eq('igreja_id', user.igreja_id),
            supabase.from('congregacoes').select('*').eq('igreja_id', user.igreja_id)
          ]);
          if (forn.data) setFornecedores(forn.data);
          if (cat.data) setCategorias(cat.data);
          if (cx.data) setCaixas(cx.data);
          if (frm.data) setFormas(frm.data);
          if (cong.data) setCongregacoes(cong.data);
        }
      }
    };
    init();
  }, []);

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

    const valorTotal = parseCurrencyInput(formData.valor);
    if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
      setModal({ isOpen: true, type: "error", title: "Valor inválido", message: "Informe um valor maior que zero." });
      return;
    }
    if (!formData.data_vencimento) {
      setModal({ isOpen: true, type: "error", title: "Vencimento obrigatório", message: "Informe a data do primeiro vencimento." });
      return;
    }
    const diaInformado = formData.dia_vencimento_mensal ? Number(formData.dia_vencimento_mensal) : null;
    if (diaInformado !== null && (!Number.isInteger(diaInformado) || diaInformado < 1 || diaInformado > 31)) {
      setModal({ isOpen: true, type: "error", title: "Dia inválido", message: "O dia de vencimento deve estar entre 1 e 31." });
      return;
    }

    setLoading(true);

    try {
      const qtdParcelas = formData.tipo_conta === "Parcelada" ? parseInt(formData.total_parcelas, 10) : 1;
      if (!Number.isInteger(qtdParcelas) || qtdParcelas < 1 || qtdParcelas > 120) {
        throw new Error("Informe uma quantidade de parcelas entre 1 e 120.");
      }
      const valorEmCentavos = Math.round(valorTotal * 100);
      const valorBaseEmCentavos = Math.floor(valorEmCentavos / qtdParcelas);
      const centavosRestantes = valorEmCentavos % qtdParcelas;
      const contasParaInserir = [];
      const diaVencimento = diaInformado
        ? diaInformado
        : Number(formData.data_vencimento.split("-")[2]);

      for (let i = 0; i < qtdParcelas; i++) {
        contasParaInserir.push({
          igreja_id: igrejaId,
          fornecedor_id: formData.fornecedor_id || null,
          descricao: formData.descricao,
          numero_documento: formData.numero_documento,
          tipo_conta: formData.tipo_conta,
          total_parcelas: qtdParcelas,
          parcela: `${i + 1}/${qtdParcelas}`,
          recorrente: formData.tipo_conta === "Recorrente",
          valor: formData.tipo_conta === "Recorrente"
            ? valorTotal
            : (valorBaseEmCentavos + (i < centavosRestantes ? 1 : 0)) / 100,
          data_emissao: formData.data_emissao || null,
          data_vencimento: i === 0 ? formData.data_vencimento : getMonthlyDate(formData.data_vencimento, i, diaVencimento),
          dia_vencimento_mensal: formData.tipo_conta === "Recorrente" ? diaVencimento : null,
          categoria_id: formData.categoria_id || null,
          caixa_id: formData.caixa_id || null,
          forma_pagamento_id: formData.forma_pagamento_id || null,
          congregacao_id: formData.congregacao_id || null,
          observacoes: formData.observacoes,
          status: 'Pendente'
        });
      }

      const { error } = await supabase.from('contas_pagar').insert(contasParaInserir);
      if (error) throw error;

      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Conta(s) cadastrada(s) com sucesso!" });
      setTimeout(() => router.push("/financeiro/contas-pagar"), 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center gap-3">
        <Link href="/financeiro/contas-pagar" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-ohel-blue" /> Nova Conta a Pagar
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Preencha os dados abaixo para registrar um compromisso único, parcelado ou recorrente.</p>
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
            <Input label="Descrição da Conta / Despesa *" name="descricao" placeholder="Ex: Aluguel da Sede, Fatura de Energia ou Compra de Som" value={formData.descricao} onChange={handleChange} required className="py-2 text-xs" />
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
            <Input label="Nº do Documento / Nota Fiscal / Boleto" name="numero_documento" placeholder="Ex: NF-10492 ou Código de Barras" value={formData.numero_documento} onChange={handleChange} className="py-2 text-xs" />
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
                <Input label="Dia de Vencimento Mensal" type="number" name="dia_vencimento_mensal" min="1" max="31" placeholder="Ex: 20" value={formData.dia_vencimento_mensal} onChange={handleChange} className="py-2 text-xs" />
                {formData.tipo_conta === "Parcelada" ? (
                  <Input label="Quantidade de Parcelas *" type="number" name="total_parcelas" min="2" max="120" placeholder="Ex: 12" value={formData.total_parcelas} onChange={handleChange} required className="py-2 text-xs" />
                ) : (
                  <p className="md:col-span-2 self-center text-xs text-gray-400">
                    Ao dar baixa, o sistema criará o próximo vencimento. Você poderá ajustar o valor da próxima conta antes de pagar.
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
            placeholder="Anotações sobre a conta, código de barras do boleto, parcelamento ou observações bancárias..."
            className="input-ohel w-full px-4 py-3 rounded-lg text-xs min-h-[100px] resize-y"
          />
        </Card>

        {/* BOTOES */}
        <div className="flex justify-end gap-3 mt-2">
          <Link href="/financeiro/contas-pagar" className="px-6 py-2.5 text-xs font-medium text-gray-400 hover:text-white transition-colors">
            Cancelar
          </Link>
          <Button type="submit" variant="primary" disabled={loading} className="w-auto px-8 py-2.5 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
            <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Salvar Conta a Pagar"}
          </Button>
        </div>

      </form>
    </div>
  );
}