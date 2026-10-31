"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Gift, Ticket } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";

export default function NovoSorteioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idToEdit = searchParams.get("editar");

  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    valor_bilhete: "10",
    total_numeros: "100",
    numero_inicial: "1",
    data_sorteio: "",
    cartaz_url: "",
    status: "ativo",
  });
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }

      if (!idToEdit) return;
      const { data, error } = await supabase.from("sorteios").select("*").eq("id", idToEdit).maybeSingle();
      if (error || !data) return;

      setForm({
        nome: data.nome || "",
        descricao: data.descricao || "",
        valor_bilhete: String(data.valor_bilhete || "10"),
        total_numeros: String(data.total_numeros || "100"),
        numero_inicial: String(data.numero_inicial || "1"),
        data_sorteio: data.data_sorteio || "",
        cartaz_url: data.cartaz_url || "",
        status: data.status || "ativo",
      });
    };

    void init();
  }, [idToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [e.target.name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível identificar a igreja do usuário logado." });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        igreja_id: igrejaId,
        nome: form.nome,
        descricao: form.descricao,
        tipo: "sorteio",
        valor_bilhete: Number(form.valor_bilhete || 0),
        total_numeros: Number(form.total_numeros || 100),
        numero_inicial: Number(form.numero_inicial || 1),
        data_sorteio: form.data_sorteio || null,
        cartaz_url: form.cartaz_url || null,
        status: form.status,
        link_publico: typeof window !== "undefined" ? `${window.location.origin}/sorteio` : null,
      };

      if (idToEdit) {
        const { error } = await supabase.from("sorteios").update(payload).eq("id", idToEdit);
        if (error) throw error;
        setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Sorteio atualizado com sucesso." });
      } else {
        const { error } = await supabase.from("sorteios").insert([payload]);
        if (error) throw error;
        setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Sorteio criado com sucesso." });
      }
    } catch (error: any) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Erro ao salvar",
        message: error?.message || "Não foi possível salvar o sorteio. Verifique se a tabela do SQL foi criada no Supabase.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => { setModal((current) => ({ ...current, isOpen: false })); if (modal.type === "success") router.push("/sorteios"); }} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/sorteios" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{idToEdit ? "Editar sorteio" : "Novo sorteio"}</h1>
            <p className="text-sm text-gray-400">Crie a rifa, reserve números e confirme o pagamento pela página pública.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-800 bg-ohel-surface p-6">
        <div className="flex items-center gap-2 text-violet-300">
          <Gift className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Configuração básica</span>
        </div>

        <Input label="Nome do sorteio *" name="nome" value={form.nome} onChange={handleChange} required />

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Descrição</label>
          <textarea name="descricao" value={form.descricao} onChange={handleChange} className="min-h-[120px] w-full rounded-lg border border-gray-700 bg-ohel-bg px-4 py-3 text-sm text-white outline-none focus:border-ohel-blue" placeholder="Detalhes, regras, data do sorteio, como funciona a confirmação do pagamento..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Valor do bilhete" name="valor_bilhete" type="number" min="0" step="0.01" value={form.valor_bilhete} onChange={handleChange} />
          <Input label="Total de números" name="total_numeros" type="number" min="1" value={form.total_numeros} onChange={handleChange} />
          <Input label="Número inicial" name="numero_inicial" type="number" min="1" value={form.numero_inicial} onChange={handleChange} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Data do sorteio" name="data_sorteio" type="date" value={form.data_sorteio} onChange={handleChange} />
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="w-full rounded-lg border border-gray-700 bg-ohel-bg px-4 py-3 text-sm text-white outline-none focus:border-ohel-blue">
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-gray-700 bg-ohel-bg/40 p-4 text-sm text-gray-300">
          <div className="flex items-center gap-2 mb-2 text-violet-300"><Ticket className="w-4 h-4" /><span className="font-semibold">Fluxo público</span></div>
          <ul className="space-y-2 text-gray-300">
            <li>• A pessoa acessa a página pública do sorteio por QR code.</li>
            <li>• Escolhe um número disponível e confirma o pagamento.</li>
            <li>• Pode anexar o comprovante na própria página de acompanhamento.</li>
            <li>• O painel marca a reserva e atualiza o gráfico de disponibilidade.</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={loading} className="px-8">
            <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : idToEdit ? "Salvar alterações" : "Criar sorteio"}
          </Button>
        </div>
      </form>
    </div>
  );
}
