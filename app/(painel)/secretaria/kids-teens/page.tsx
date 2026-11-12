"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { Baby, Check, CheckCircle, Copy, Package, QrCode, ShieldAlert, Truck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { podeAcessar } from "@/lib/access";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { useAccess } from "@/components/layout/AccessShell";
import { criarLinkPublicoKids } from "@/lib/public-site";

interface KidsTeensRegistration {
  id: string;
  nome: string;
  data_nascimento: string;
  faixa: "kids" | "teens";
  nome_responsavel: string;
  parentesco_responsavel: string;
  telefone_responsavel: string;
  pessoas_autorizadas: string | null;
  informacoes_saude: string | null;
  status: "pendente" | "aprovado" | "rejeitado";
  created_at: string;
}

type Related<T> = T | T[] | null | undefined;

interface EscalaAtribuicao {
  id: string;
  nome_manual: string | null;
  funcoes_escala?: Related<{ nome: string }>;
  membros?: Related<{ nome: string | null; telefone: string | null }>;
}

interface EscalaKids {
  id: string;
  titulo: string;
  data_culto: string;
  horario_inicio: string | null;
  escalados: EscalaAtribuicao[] | null;
}

function oneRelated<T>(value: Related<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatScaleDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export default function KidsTeensPage() {
  const [igrejaId, setIgrejaId] = useState("");
  const [kidsDepartamentoId, setKidsDepartamentoId] = useState("");
  const [registrations, setRegistrations] = useState<KidsTeensRegistration[]>([]);
  const [escalasFuturas, setEscalasFuturas] = useState<EscalaKids[]>([]);
  const [responsavelNaEscala, setResponsavelNaEscala] = useState("");
  const [lancheSolicitado, setLancheSolicitado] = useState("");
  const [quantidadeLanche, setQuantidadeLanche] = useState("1");
  const [observacoesLanche, setObservacoesLanche] = useState("");
  const [erroEscalas, setErroEscalas] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "pendente" | "aprovado" | "rejeitado">("pendente");
  const [selected, setSelected] = useState<KidsTeensRegistration | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const contexto = useAccess();
  const podeVerCatalogo = Boolean(contexto && podeAcessar(contexto, "financeiro", "ler"));

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: user, error: userError } = await supabase
        .from("usuarios")
        .select("igreja_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (userError) {
        setFeedback({ isOpen: true, type: "error", title: "Erro de acesso", message: userError.message });
        setLoading(false);
        return;
      }

      if (!user?.igreja_id) {
        setLoading(false);
        return;
      }
      setIgrejaId(user.igreja_id);

      const { data: departamentos } = await supabase
        .from("departamentos")
        .select("id, nome")
        .eq("igreja_id", user.igreja_id)
        .eq("ativo", true)
        .order("nome");
      const departamentoKids = departamentos?.find((departamento) => /kids|infantil|crian[çc]a/i.test(departamento.nome));
      setKidsDepartamentoId(departamentoKids?.id || "");

      const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const { data: escalas, error: escalasError } = await supabase
        .from("escalas")
        .select("id, titulo, data_culto, horario_inicio, escalados(id, nome_manual, funcoes_escala(nome), membros(nome, telefone))")
        .eq("igreja_id", user.igreja_id)
        .gte("data_culto", hoje)
        .order("data_culto", { ascending: true })
        .limit(80);
      if (escalasError) {
        setErroEscalas("Não foi possível carregar as próximas escalas. Verifique a permissão do módulo Escalas.");
      } else {
        setEscalasFuturas((escalas || []) as unknown as EscalaKids[]);
      }

      const { data, error } = await supabase
        .from("kids_teens_pre_cadastros")
        .select("*")
        .eq("igreja_id", user.igreja_id)
        .order("created_at", { ascending: false });

      if (error) {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Não foi possível carregar os cadastros",
          message: "Confirme se o SQL Kids & Teens foi executado e se sua conta possui permissão de acesso.",
        });
      } else {
        setRegistrations((data || []) as KidsTeensRegistration[]);
      }
      setLoading(false);
    };

    void initialize();
  }, []);

  const publicUrl = criarLinkPublicoKids(igrejaId);
  const filtered = registrations.filter((item) => filter === "todos" || item.status === filter);
  const pendingCount = registrations.filter((item) => item.status === "pendente").length;
  const pessoasEscaladas = escalasFuturas.flatMap((escala) => (escala.escalados || []).map((atribuicao) => {
    const membro = oneRelated(atribuicao.membros);
    const funcao = oneRelated(atribuicao.funcoes_escala);
    return {
      id: atribuicao.id,
      escala,
      nome: membro?.nome || atribuicao.nome_manual || "Pessoa escalada",
      telefone: membro?.telefone || "",
      funcao: funcao?.nome || "Equipe",
    };
  })).filter((pessoa) => /kids|infantil|crian[çc]a|berç|tia/i.test(pessoa.funcao));
  const destinatarioEscala = pessoasEscaladas.find((pessoa) => pessoa.id === responsavelNaEscala) || null;
  const telefoneWhatsApp = (destinatarioEscala?.telefone || "").replace(/\D/g, "");
  const telefoneCompleto = telefoneWhatsApp && !telefoneWhatsApp.startsWith("55") ? `55${telefoneWhatsApp}` : telefoneWhatsApp;
  const quantidadeValida = Number.isInteger(Number(quantidadeLanche)) && Number(quantidadeLanche) > 0;
  const mensagemLanche = destinatarioEscala
    ? `Olá, ${destinatarioEscala.nome}! Você está na escala de ${destinatarioEscala.escala.titulo} em ${formatScaleDate(destinatarioEscala.escala.data_culto)}${destinatarioEscala.escala.horario_inicio ? ` às ${destinatarioEscala.escala.horario_inicio}` : ""}. Poderia providenciar ${quantidadeLanche} ${lancheSolicitado.trim()} para o Espaço Kids?${observacoesLanche.trim() ? ` Observação: ${observacoesLanche.trim()}` : ""}`
    : "";
  const linkSolicitacaoWhatsApp = telefoneCompleto && lancheSolicitado.trim() && quantidadeValida
    ? `https://wa.me/${telefoneCompleto}?text=${encodeURIComponent(mensagemLanche)}`
    : "";

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setFeedback({ isOpen: true, type: "success", title: "Link copiado", message: "Compartilhe o link ou o QR Code com as famílias." });
    } catch {
      setFeedback({ isOpen: true, type: "error", title: "Não foi possível copiar", message: "Copie o endereço exibido abaixo do QR Code manualmente." });
    }
  };

  const setStatus = async (item: KidsTeensRegistration, status: KidsTeensRegistration["status"]) => {
    const { error } = await supabase
      .from("kids_teens_pre_cadastros")
      .update({ status })
      .eq("id", item.id)
      .eq("igreja_id", igrejaId);

    if (error) {
      setFeedback({ isOpen: true, type: "error", title: "Erro ao atualizar", message: error.message });
      return;
    }

    setRegistrations((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    setSelected((current) => current?.id === item.id ? { ...current, status } : current);
  };

  const getAge = (birthDate: string) => {
    const birth = new Date(`${birthDate}T12:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return age;
  };

  const getWhatsAppLink = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const internationalNumber = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${internationalNumber}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback((current) => ({ ...current, isOpen: false }))}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
      />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Baby className="h-6 w-6 text-pink-300" /> Kids & Teens</h1>
          <p className="mt-1 text-sm text-gray-400">Pré-cadastros digitais, QR Code e análise pela equipe da igreja.</p>
        </div>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          disabled={!igrejaId}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-ohel-blue px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          <QrCode className="h-4 w-4" /> QR Code de pré-cadastro
        </button>
      </div>

      <Card className="border-gray-800 p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Lanches e estoque do Espaço Kids</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-400">
                Use o catálogo da igreja no departamento Kids: cadastre o lanche, saldo atual, estoque mínimo e fornecedor. Itens abaixo do mínimo ficam destacados, sem duplicar produtos ou fornecedores.
              </p>
            </div>
          </div>
          {podeVerCatalogo ? (
            kidsDepartamentoId ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href={`/financeiro/produtos?departamento=${encodeURIComponent(kidsDepartamentoId)}`} className="inline-flex items-center gap-2 rounded-md bg-ohel-blue px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600">
                  <Package className="h-4 w-4" /> Lanches e estoque
                </Link>
                <Link href={`/financeiro/fornecedores?departamento=${encodeURIComponent(kidsDepartamentoId)}`} className="inline-flex items-center gap-2 rounded-md border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white">
                  <Truck className="h-4 w-4" /> Fornecedores
                </Link>
              </div>
            ) : (
              <Link href="/financeiro/departamentos" className="shrink-0 rounded-md border border-amber-500/30 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10">
                Configurar departamento Kids
              </Link>
            )
          ) : (
            <p className="max-w-sm rounded-md border border-gray-800 bg-ohel-bg px-3 py-2 text-xs leading-5 text-gray-400">
              O catálogo é compartilhado com Financeiro. Para abrir estoque e fornecedores, a conta precisa ter permissão de leitura nesse módulo.
            </p>
          )}
        </div>
      </Card>

      <Card className="border-gray-800 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-300"><Truck className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-bold text-white">Solicitar lanche para uma escala</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-400">Escolha uma pessoa já designada e prepare uma mensagem com a data do serviço. O WhatsApp abrirá para você revisar e enviar; a solicitação não altera o estoque automaticamente.</p>
          </div>
        </div>
        {erroEscalas ? (
          <p className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">{erroEscalas}</p>
        ) : pessoasEscaladas.length === 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-gray-800 bg-ohel-bg p-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <p>Não há uma pessoa designada em uma função identificada como Kids/Infantil nas escalas futuras. Em Secretaria → Escalas, crie a escala e atribua a função da equipe infantil, com telefone cadastrado para WhatsApp.</p>
            <Link href="/secretaria/escalas" className="shrink-0 rounded-md border border-gray-700 px-3 py-2 text-center font-semibold text-gray-200 hover:bg-white/5">Abrir Escalas</Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Pessoa designada na escala</label>
              <select value={responsavelNaEscala} onChange={(event) => setResponsavelNaEscala(event.target.value)} className="input-ohel w-full rounded-md px-3 py-2 text-xs">
                <option value="">Selecione a escala e a pessoa</option>
                {pessoasEscaladas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>{formatScaleDate(pessoa.escala.data_culto)} · {pessoa.escala.titulo} · {pessoa.funcao} — {pessoa.nome}{pessoa.telefone ? "" : " (sem telefone cadastrado)"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Lanche</label>
              <input value={lancheSolicitado} onChange={(event) => setLancheSolicitado(event.target.value)} placeholder="Ex.: frutas e suco" className="input-ohel w-full rounded-md px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Quantidade</label>
              <input type="number" min="1" step="1" value={quantidadeLanche} onChange={(event) => setQuantidadeLanche(event.target.value)} className="input-ohel w-full rounded-md px-3 py-2 text-xs" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Observação (opcional)</label>
              <textarea value={observacoesLanche} onChange={(event) => setObservacoesLanche(event.target.value)} placeholder="Preferências, horário para levar ou outro detalhe" className="input-ohel min-h-16 w-full rounded-md px-3 py-2 text-xs" />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              {destinatarioEscala && !destinatarioEscala.telefone && <p className="text-xs text-amber-200">Cadastre o telefone dessa pessoa em Membros para abrir uma solicitação no WhatsApp.</p>}
              <a href={linkSolicitacaoWhatsApp || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!linkSolicitacaoWhatsApp} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs font-semibold ${linkSolicitacaoWhatsApp ? "bg-green-600 text-white hover:bg-green-500" : "cursor-not-allowed bg-gray-800 text-gray-500"}`}>
                <Truck className="h-4 w-4" /> Abrir solicitação no WhatsApp
              </a>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Todos os cadastros", value: registrations.length },
          { label: "Aguardando análise", value: pendingCount },
          { label: "Kids / Teens", value: `${registrations.filter((item) => item.faixa === "kids").length} / ${registrations.filter((item) => item.faixa === "teens").length}` },
        ].map((item) => (
          <Card key={item.label} className="border-gray-800 p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-gray-800 p-0">
        <div className="flex gap-2 overflow-x-auto border-b border-gray-800 p-3">
          {(["pendente", "todos", "aprovado", "rejeitado"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-md px-4 py-2 text-xs font-semibold capitalize transition ${filter === value ? "bg-ohel-blue text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              {value === "todos" ? "Todos" : value}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-gray-800 bg-ohel-surface/70 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Faixa</th>
                <th className="p-4 font-medium">Responsável / WhatsApp</th>
                <th className="p-4 font-medium">Recebido</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-sm">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Carregando pré-cadastros...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum pré-cadastro nesta lista.</td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="p-4">
                    <button type="button" onClick={() => setSelected(item)} className="text-left font-semibold text-white hover:text-blue-300">
                      {item.nome}
                    </button>
                    <p className="mt-1 text-xs text-gray-500">{getAge(item.data_nascimento)} anos</p>
                  </td>
                  <td className="p-4 capitalize text-gray-300">{item.faixa}</td>
                  <td className="p-4">
                    <p className="text-gray-200">{item.nome_responsavel}</p>
                    <a href={getWhatsAppLink(item.telefone_responsavel)} target="_blank" rel="noreferrer" className="text-xs text-green-400 hover:underline">
                      {item.telefone_responsavel}
                    </a>
                  </td>
                  <td className="p-4 text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-4">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${item.status === "pendente" ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : item.status === "aprovado" ? "border-green-500/20 bg-green-500/10 text-green-300" : "border-gray-600 bg-gray-500/10 text-gray-400"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="inline-flex gap-2">
                      <button type="button" onClick={() => setSelected(item)} className="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white">Detalhes</button>
                      {item.status !== "aprovado" && (
                        <button type="button" onClick={() => void setStatus(item, "aprovado")} aria-label={`Aprovar ${item.nome}`} className="rounded border border-green-500/30 p-1.5 text-green-300 hover:bg-green-500/10"><Check className="h-4 w-4" /></button>
                      )}
                      {item.status !== "rejeitado" && (
                        <button type="button" onClick={() => void setStatus(item, "rejeitado")} aria-label={`Arquivar ${item.nome}`} className="rounded border border-gray-700 p-1.5 text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <Card role="dialog" aria-modal="true" aria-labelledby="kids-qr-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col items-center overflow-y-auto border-gray-700 p-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10 text-pink-300"><QrCode className="h-6 w-6" /></div>
            <h2 id="kids-qr-title" className="text-xl font-bold text-white">Pré-cadastro Kids & Teens</h2>
            <p className="mt-2 text-sm text-gray-400">Compartilhe este QR Code com as famílias. O formulário identifica automaticamente Kids ou Teens pela idade.</p>
            <div className="my-5 w-full max-w-[242px] shrink-0 rounded-xl bg-white p-4">{publicUrl && <QRCode value={publicUrl} size={210} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />}</div>
            <div className="mb-5 w-full break-all rounded-lg border border-gray-800 bg-ohel-bg p-3 text-left text-xs text-gray-400">{publicUrl}</div>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="mb-4 inline-flex min-h-10 items-center text-sm text-blue-300 hover:underline">Abrir formulário público</a>
            <div className="flex w-full gap-3">
              <button type="button" onClick={() => setQrOpen(false)} className="flex-1 rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:text-white">Fechar</button>
              <button type="button" onClick={() => void copyLink()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-ohel-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"><Copy className="h-4 w-4" /> Copiar link</button>
            </div>
          </Card>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-gray-700 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.nome}</h2>
                <p className="mt-1 text-sm capitalize text-pink-200">{selected.faixa} · {getAge(selected.data_nascimento)} anos</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fechar detalhes" className="rounded p-1 text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail label="Nascimento" value={new Date(`${selected.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR")} />
              <Detail label="Status" value={selected.status} />
              <Detail label="Responsável legal" value={`${selected.nome_responsavel} (${selected.parentesco_responsavel})`} />
              <Detail label="WhatsApp" value={selected.telefone_responsavel} />
              <Detail label="Pessoas autorizadas a retirar" value={selected.pessoas_autorizadas || "Não informado"} />
              <Detail label="Alergias, medicamentos e cuidados" value={selected.informacoes_saude || "Não informado"} />
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Dados de menores: consulte apenas para organização e segurança das atividades da igreja.
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:text-white">Fechar</button>
              {selected.status !== "aprovado" && (
                <button type="button" onClick={() => void setStatus(selected, "aprovado")} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"><CheckCircle className="h-4 w-4" /> Aprovar</button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-ohel-bg/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-200">{value}</p>
    </div>
  );
}
