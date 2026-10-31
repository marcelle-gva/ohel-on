"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Gift, QrCode, Ticket } from "lucide-react";
import QRCode from "react-qr-code";

interface SorteioPublico {
  id: string;
  nome: string;
  descricao: string | null;
  valor_bilhete: number;
  total_numeros: number;
  numero_inicial: number;
  numero_final: number;
  data_sorteio: string | null;
  reservados: number[];
}

function isSorteioPublico(value: unknown): value is SorteioPublico {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.nome === "string"
    && (record.descricao === null || typeof record.descricao === "string")
    && typeof record.valor_bilhete === "number"
    && typeof record.total_numeros === "number"
    && typeof record.numero_inicial === "number"
    && typeof record.numero_final === "number"
    && (record.data_sorteio === null || typeof record.data_sorteio === "string")
    && Array.isArray(record.reservados)
    && record.reservados.every((numero) => typeof numero === "number");
}

function isReservationResult(value: unknown): value is { token: string; numero: number } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.token === "string" && typeof record.numero === "number";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export default function SorteioPublicPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sorteioId = params.id;

  const [sorteio, setSorteio] = useState<SorteioPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numSelecionado, setNumSelecionado] = useState("");
  const [form, setForm] = useState({ nome: "", telefone: "" });
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const [reservados, setReservados] = useState<number[]>([]);

  useEffect(() => {
    const fetchSorteio = async () => {
      if (!sorteioId) return;
      try {
        const { data, error } = await supabase.rpc("get_sorteio_publico", { p_sorteio_id: sorteioId });
        if (error) throw error;
        if (!isSorteioPublico(data)) throw new Error("Este sorteio não está disponível.");
        setSorteio(data);
        setReservados(data.reservados.map(Number));
      } catch (error: unknown) {
        setModal({ isOpen: true, type: "error", title: "Sorteio não encontrado", message: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    };

    void fetchSorteio();
  }, [sorteioId]);

  const numerosDisponiveis = useMemo(() => {
    if (!sorteio) return [];
    const start = Number(sorteio.numero_inicial || 1);
    const end = Number(sorteio.numero_final || sorteio.total_numeros || 100);
    const lista: number[] = [];
    for (let i = start; i <= end; i += 1) {
      if (!reservados.includes(i)) lista.push(i);
    }
    return lista;
  }, [reservados, sorteio]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sorteio || !form.nome || !form.telefone || !numSelecionado) {
      setModal({ isOpen: true, type: "error", title: "Dados incompletos", message: "Preencha o nome, telefone e escolha um número disponível." });
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase.rpc("reservar_numero_sorteio", {
        p_sorteio_id: sorteio.id,
        p_nome: form.nome,
        p_telefone: form.telefone,
        p_numero: Number(numSelecionado),
      });
      if (error) throw error;
      if (!isReservationResult(data)) throw new Error("A reserva foi criada, mas não foi possível gerar o link de acompanhamento.");

      setForm({ nome: "", telefone: "" });
      setNumSelecionado("");
      setModal({ isOpen: true, type: "success", title: "Reserva confirmada", message: `Sua reserva foi registrada para o número ${data.numero}.` });
      const navigateUrl = `/sorteio/${sorteio.id}/acompanhar#token=${encodeURIComponent(data.token)}`;
      router.push(navigateUrl);
    } catch (error: unknown) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Não foi possível reservar",
        message: getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-ohel-bg text-gray-300">Carregando sorteio...</div>;

  if (!sorteio) return <div className="min-h-screen flex items-center justify-center bg-ohel-bg text-white">Sorteio não encontrado.</div>;

  return (
    <div className="min-h-screen bg-ohel-bg text-white">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal((current) => ({ ...current, isOpen: false }))} type={modal.type} title={modal.title} message={modal.message} />

      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <Card className="overflow-hidden border-gray-800 bg-ohel-surface/70">
          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 md:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
                <Gift className="w-3.5 h-3.5" /> Sorteio
              </div>

              <h1 className="mb-2 text-3xl font-bold text-white">{sorteio.nome}</h1>
              <p className="mb-5 text-sm text-gray-400">{sorteio.descricao || "Participe escolhendo um número disponível e confirme o pagamento para validar a reserva."}</p>

              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-800 bg-ohel-bg/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">Valor</div>
                  <div className="mt-2 text-lg font-bold text-white">R$ {Number(sorteio.valor_bilhete || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="rounded-xl border border-gray-800 bg-ohel-bg/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">Disponíveis</div>
                  <div className="mt-2 text-lg font-bold text-white">{numerosDisponiveis.length}</div>
                </div>
                <div className="rounded-xl border border-gray-800 bg-ohel-bg/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">Sorteio</div>
                  <div className="mt-2 text-lg font-bold text-white">{sorteio.data_sorteio || "A definir"}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Seu nome" name="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                <Input label="Telefone" name="telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} required />

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">Número disponível</label>
                  <div className="grid max-h-52 grid-cols-5 gap-2 overflow-auto rounded-xl border border-gray-800 bg-ohel-bg p-3">
                    {numerosDisponiveis.length === 0 ? (
                      <div className="col-span-5 text-sm text-gray-400">Nenhum número livre agora.</div>
                    ) : (
                      numerosDisponiveis.map((numero) => (
                        <button
                          key={numero}
                          type="button"
                          onClick={() => setNumSelecionado(String(numero))}
                          className={`rounded-lg border px-2 py-2 text-sm transition ${numSelecionado === String(numero) ? "border-violet-400 bg-violet-500/20 text-violet-100" : "border-gray-700 bg-[#0f172a] text-gray-200 hover:border-violet-500/50"}`}
                        >
                          {numero}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <Button type="submit" variant="primary" disabled={saving} className="w-full mt-4">
                  {saving ? "Reservando..." : "Reservar número"}
                </Button>
              </form>
            </div>

            <div className="border-t border-gray-800 bg-ohel-bg/50 p-6 md:border-l md:border-t-0">
              <div className="mb-4 flex items-center gap-2 text-violet-300"><QrCode className="w-5 h-5" /> <span className="text-sm font-semibold uppercase tracking-[0.2em]">Compartilhar</span></div>
              <div className="rounded-2xl border border-gray-800 bg-white p-4 w-fit mx-auto">
                <QRCode value={typeof window !== "undefined" ? `${window.location.origin}/sorteio/${sorteio.id}` : ""} size={180} />
              </div>

              <div className="mt-5 rounded-xl border border-gray-800 bg-ohel-bg/50 p-4 text-sm text-gray-300">
                <div className="flex items-center gap-2 mb-2 text-white"><Ticket className="w-4 h-4 text-violet-300" /><span className="font-semibold">Acompanhamento</span></div>
                <p className="text-gray-400">Você pode anexar o comprovante e acompanhar o status depois da inscrição.</p>
                <p className="mt-4 text-xs text-gray-500">Após reservar, você receberá um link privado para acompanhar esta reserva.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
