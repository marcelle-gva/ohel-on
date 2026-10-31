"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { CheckCircle, Upload, Loader2 } from "lucide-react";

interface AcompanhamentoSorteio {
  participante_id: string;
  sorteio_nome: string;
  nome: string;
  numero: number;
  valor: number;
  status: string;
  comprovante_url: string | null;
}

function isAcompanhamentoSorteio(value: unknown): value is AcompanhamentoSorteio {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.participante_id === "string"
    && typeof record.sorteio_nome === "string"
    && typeof record.nome === "string"
    && typeof record.numero === "number"
    && typeof record.valor === "number"
    && typeof record.status === "string"
    && (record.comprovante_url === null || typeof record.comprovante_url === "string");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export default function AcompanhamentoSorteioPage() {
  const params = useParams<{ id: string }>();
  const inputRef = useRef<HTMLInputElement>(null);

  const [sorteio, setSorteio] = useState<{ nome: string } | null>(null);
  const [participante, setParticipante] = useState<AcompanhamentoSorteio | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const readToken = () => {
      const fragment = window.location.hash.slice(1);
      setToken(new URLSearchParams(fragment).get("token") || "");
    };

    readToken();
    window.addEventListener("hashchange", readToken);
    return () => window.removeEventListener("hashchange", readToken);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!params.id || !token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase.rpc("get_acompanhamento_sorteio", {
          p_sorteio_id: params.id,
          p_token: token,
        });
        if (error) throw error;
        if (!isAcompanhamentoSorteio(data)) throw new Error("Link de acompanhamento inválido ou expirado.");

        setSorteio({ nome: data.sorteio_nome });
        setParticipante(data);
      } catch (error: unknown) {
        setModal({ isOpen: true, type: "error", title: "Acompanhamento não encontrado", message: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [params.id, token]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !participante || !token) return;

    try {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
        throw new Error("Envie uma imagem JPG, PNG, WebP ou PDF de até 5 MB.");
      }

      setUploading(true);
      const fileExt = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
      const fileName = `sorteio-${participante.participante_id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("comprovantes").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("comprovantes").getPublicUrl(fileName);

      const { error: updateError } = await supabase.rpc("registrar_comprovante_sorteio", {
        p_sorteio_id: params.id,
        p_token: token,
        p_comprovante_url: data.publicUrl,
      });
      if (updateError) throw updateError;
      setParticipante((current) => current && ({
        ...current,
        comprovante_url: data.publicUrl,
        status: current.status === "confirmado" ? current.status : "reservado",
      }));
      setModal({ isOpen: true, type: "success", title: "Comprovante enviado", message: "O comprovante foi anexado e aguarda conferência da igreja. O envio não confirma o pagamento." });
    } catch (error: unknown) {
      setModal({ isOpen: true, type: "error", title: "Erro ao enviar", message: getErrorMessage(error) });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-ohel-bg text-gray-300">Carregando acompanhamento...</div>;

  if (!participante || !sorteio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ohel-bg p-6">
        <Card className="max-w-md border border-gray-800 bg-ohel-surface p-8 text-center text-white">
          <p className="text-lg font-semibold">Acompanhamento não encontrado</p>
          <p className="mt-2 text-sm text-gray-400">Verifique o número informado ou faça uma nova inscrição.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ohel-bg text-white">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal((current) => ({ ...current, isOpen: false }))} type={modal.type} title={modal.title} message={modal.message} />

      <div className="mx-auto max-w-3xl p-6">
        <Card className="border border-gray-800 bg-ohel-surface p-6">
          <div className="mb-4 flex items-center gap-2 text-violet-300">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Acompanhamento da reserva</span>
          </div>

          <h1 className="text-2xl font-bold text-white">{sorteio.nome}</h1>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-800 bg-ohel-bg/60 p-4">
              <div className="text-xs uppercase tracking-wider text-gray-500">Participante</div>
              <div className="mt-2 text-lg font-semibold text-white">{participante.nome}</div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-ohel-bg/60 p-4">
              <div className="text-xs uppercase tracking-wider text-gray-500">Número reservado</div>
              <div className="mt-2 text-lg font-semibold text-white">{participante.numero}</div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-gray-800 bg-ohel-bg/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500">Status</div>
                <div className="mt-2 text-lg font-semibold text-white">{participante.status}</div>
              </div>
              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase text-violet-300">{participante.status}</span>
            </div>
          </div>

          <div className="mt-6">
            <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} variant="primary" className="w-full">
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando comprovante...</> : <><Upload className="mr-2 h-4 w-4" /> Anexar comprovante de pagamento</>}
            </Button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
          </div>

          {participante.comprovante_url && (
            <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
              Comprovante anexado: <a href={participante.comprovante_url} target="_blank" rel="noreferrer" className="underline">abrir arquivo</a>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
