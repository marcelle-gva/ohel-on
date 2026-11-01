import Link from "next/link";
import {
  ArrowRight,
  Baby,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckSquare,
  Church,
  ClipboardCheck,
  CircleDollarSign,
  HeartHandshake,
  MonitorPlay,
  Music,
  QrCode,
  ShieldCheck,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const quoteLink = `https://wa.me/5521996288956?text=${encodeURIComponent("Olá! Quero solicitar uma cotação do sistema OHEL ON.")}`;

const modules = [
  {
    icon: UsersRound,
    title: "Pessoas e secretaria",
    description: "Organize membros, visitantes e congregações e deixe as informações importantes acessíveis à equipe, sem depender de anotações espalhadas.",
  },
  {
    icon: Wallet,
    title: "Cadastros e carteirinhas",
    description: "Mantenha os cadastros da comunidade organizados e apoie a identificação dos membros.",
  },
  {
    icon: CalendarDays,
    title: "Eventos e sorteios",
    description: "Divulgue eventos, receba inscrições públicas e gerencie sorteios com reserva de números.",
  },
  {
    icon: HeartHandshake,
    title: "Escalas e serviço",
    description: "Crie e acompanhe escalas para organizar equipes e ajudar todos a se lembrarem dos compromissos.",
  },
  {
    icon: BookOpen,
    title: "Cultos e comunhão",
    description: "Projete louvores, acompanhe pedidos de oração e exiba avisos e lembretes durante o culto.",
  },
  {
    icon: Baby,
    title: "Kids & Teens",
    description: "Receba pré-cadastros de crianças e adolescentes pelo QR Code, com contato do responsável e informações importantes para o cuidado.",
  },
  {
    icon: BarChart3,
    title: "Mural e gestão",
    description: "Publique comunicados e reúna rotinas administrativas em uma plataforma acessível pela nuvem.",
  },
];

export default function HomePage() {
  return (
    <main className="h-screen overflow-y-auto bg-[#03060D] text-white selection:bg-blue-500/30">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#03060D]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <Link href="/" aria-label="OHEL ON - início">
            <Logo className="h-12 w-28 md:h-14 md:w-32" />
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition hover:text-white">
              Área Administrativa
            </Link>
            <Link href="/login-membro" className="rounded-lg px-4 py-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200">
              Área do Membro
            </Link>
            <a
              href={quoteLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500"
            >
              Solicitar cotação
            </a>
          </nav>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute -right-32 top-20 h-[26rem] w-[26rem] rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        </div>

        <div className="mx-auto grid min-h-[680px] max-w-7xl items-center gap-14 px-5 py-20 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-200">
              <Church className="h-3.5 w-3.5" />
              Gestão feita para servir a igreja
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Mais cuidado com pessoas.
              <span className="mt-2 block bg-gradient-to-r from-blue-300 via-cyan-200 to-white bg-clip-text text-transparent">
                Mais clareza na gestão.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-gray-300 md:text-lg">
              A Igreja Pentecostal Ohel abriu seu sistema de gestão para servir também outras igrejas.
              Pela tecnologia na nuvem, compartilhamos facilidades de gestão e conhecimento,
              fortalecemos a comunhão e colocamos a inovação a serviço do Reino.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href={quoteLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Solicitar cotação <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                Acessar Área Administrativa
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-gray-400">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Módulos integrados</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Acesso pelo navegador</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Gestão multiárea</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-blue-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#080E1B]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                    <Church className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Visão geral da igreja</p>
                    <p className="mt-0.5 text-xs text-gray-500">Dashboard OHEL ON</p>
                  </div>
                </div>
                <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-blue-200">
                  Prévia ilustrativa
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-gray-400">A paz do Senhor!</p>
                  <p className="mt-1 text-sm font-semibold text-white">Resumo da igreja</p>
                </div>
                <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-right">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500">Acesso</p>
                  <p className="mt-1 text-[10px] font-semibold text-emerald-300">Painel integrado</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { icon: UsersRound, title: "Membros", value: "Secretaria", color: "text-blue-300 bg-blue-400/10" },
                  { icon: HeartHandshake, title: "Pessoas", value: "Congregados", color: "text-emerald-300 bg-emerald-400/10" },
                  { icon: CircleDollarSign, title: "Financeiro", value: "Movimentos", color: "text-amber-200 bg-amber-400/10" },
                  { icon: CalendarDays, title: "Agenda", value: "Eventos", color: "text-violet-300 bg-violet-400/10" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">{item.title}</p>
                        <Icon className={`h-3.5 w-3.5 ${item.color.split(" ")[0]}`} />
                      </div>
                      <p className="mt-3 text-xs font-semibold text-white">{item.value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-white">Acesso rápido</p>
                      <p className="mt-1 text-[9px] text-gray-500">Módulos da gestão</p>
                    </div>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { icon: UsersRound, label: "Secretaria", color: "text-cyan-300" },
                      { icon: Wallet, label: "Financeiro", color: "text-emerald-300" },
                      { icon: CalendarDays, label: "Eventos", color: "text-violet-300" },
                      { icon: BookOpen, label: "Ensino", color: "text-amber-200" },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-1.5 rounded-lg bg-white/[0.035] px-2 py-2">
                          <Icon className={`h-3 w-3 ${item.color}`} />
                          <span className="text-[9px] text-gray-300">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-400/10 text-blue-300">
                        <MonitorPlay className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-white">Monitor de Mídia</p>
                        <p className="text-[9px] text-gray-500">Apoio ao culto</p>
                      </div>
                    </div>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      { icon: UsersRound, label: "Visitantes", detail: "Acolhimento" },
                      { icon: Music, label: "Louvores", detail: "Projeção" },
                      { icon: CheckSquare, label: "Escalas", detail: "Equipe" },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center justify-between rounded-lg bg-white/[0.035] px-2 py-1.5">
                          <span className="flex items-center gap-1.5 text-[9px] text-gray-300">
                            <Icon className="h-3 w-3 text-blue-300" />{item.label}
                          </span>
                          <span className="text-[8px] text-gray-500">{item.detail}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-xl border border-pink-400/15 bg-gradient-to-r from-pink-500/[0.08] to-violet-500/[0.05] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-pink-300/15 bg-pink-400/10 text-pink-200">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-semibold text-white">Pré-cadastro Kids & Teens por QR Code</p>
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[8px] font-semibold text-emerald-200">Responsável preenche</span>
                  </div>
                  <p className="mt-1 text-[9px] text-gray-400">Faixa etária, contatos autorizados e cuidados importantes em um fluxo organizado.</p>
                </div>
                <div className="hidden shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-black/10 px-2 py-1.5 sm:flex">
                  <ClipboardCheck className="h-3 w-3 text-pink-200" />
                  <span className="text-[8px] text-gray-300">Revisão da equipe</span>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-blue-400/15 bg-gradient-to-r from-blue-500/10 to-cyan-500/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-blue-100">Secretaria, dashboard e monitor integrados</p>
                    <p className="mt-1 text-[9px] text-gray-400">Tecnologia compartilhada para servir mais igrejas.</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-400/10 text-blue-300">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden items-center gap-3 rounded-2xl border border-white/10 bg-[#0B1424] px-4 py-3 shadow-xl sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <HeartHandshake className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Tecnologia a serviço</p>
                <p className="text-[11px] text-gray-500">do cuidado e da organização</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[0.8fr_1.2fr] md:items-center md:px-8 md:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
              <HeartHandshake className="h-3.5 w-3.5" />
              Uma iniciativa da Igreja Pentecostal Ohel
            </div>
            <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              O que nasceu para servir uma igreja, agora pode servir muitas.
            </h2>
          </div>
          <div className="space-y-4 text-sm leading-7 text-gray-300 md:text-base">
            <p>
              A Igreja Pentecostal Ohel desenvolveu seu sistema de gestão para apoiar o trabalho
              diário da igreja. Vendo que essa experiência poderia abençoar outras comunidades,
              decidiu abrir a tecnologia e colocá-la também a serviço delas.
            </p>
            <p>
              Agora, igrejas podem se unir por meio de uma plataforma na nuvem, compartilhar
              facilidades de gestão e conhecimento e fortalecer a comunhão. Uma tecnologia que
              nasceu de uma necessidade real e cresce para servir ao Reino.
            </p>
            <p className="border-l-2 border-blue-400/60 pl-4 font-medium text-blue-100">
              OHEL ON — tecnologia compartilhada, igrejas conectadas e inovação em favor do Reino.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Organização que libera tempo para cuidar</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              Menos correria nos bastidores. Mais presença no que importa.
            </h2>
            <p className="mt-4 text-sm leading-6 text-gray-400 md:text-base">
              Quando cadastros ficam em lugares diferentes, escalas dependem de lembretes de última hora
              e informações do culto se perdem, a equipe trabalha dobrado. O OHEL ON reúne ferramentas
              para dar mais clareza às rotinas e apoiar o cuidado com as pessoas.
            </p>
            <a
              href={quoteLink}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-white"
            >
              Converse com nossa equipe <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                pain: "Informações espalhadas",
                solution: "Cadastros e contatos organizados para a equipe encontrar o que precisa.",
                icon: UsersRound,
                accent: "text-cyan-200 bg-cyan-400/10 border-cyan-300/15",
              },
              {
                pain: "Escalas esquecidas ou confusas",
                solution: "Visualize equipes e compromissos com mais clareza na rotina da igreja.",
                icon: CheckSquare,
                accent: "text-amber-100 bg-amber-400/10 border-amber-300/15",
              },
              {
                pain: "Culto com muitos detalhes para coordenar",
                solution: "Acesse louvores, avisos, orações e recursos do Monitor de Mídia.",
                icon: MonitorPlay,
                accent: "text-blue-200 bg-blue-400/10 border-blue-300/15",
              },
              {
                pain: "Cuidado infantil exige atenção",
                solution: "Receba pré-cadastros Kids & Teens por QR Code com dados do responsável e cuidados informados.",
                icon: Baby,
                accent: "text-pink-200 bg-pink-400/10 border-pink-300/15",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.pain} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-white/15 hover:bg-white/[0.04]">
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${item.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{item.pain}</h3>
                  <p className="mt-2 text-xs leading-5 text-gray-400">{item.solution}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Uma visão completa</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            As principais rotinas da igreja, conectadas
          </h2>
          <p className="mt-4 text-sm leading-6 text-gray-400 md:text-base">
            Do cuidado com as pessoas à organização dos cultos: facilidades de gestão para a missão da sua igreja.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <article key={module.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition hover:border-blue-400/25 hover:bg-white/[0.04]">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/10 text-blue-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{module.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 pb-20 md:px-8 md:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-3xl border border-blue-300/15 bg-gradient-to-br from-blue-500/10 via-[#080E1B] to-cyan-500/[0.04] p-7 sm:p-10 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Vamos conversar?</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Veja como o OHEL ON pode apoiar sua igreja.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">Solicite uma cotação e converse com nossa equipe pelo WhatsApp.</p>
          </div>
          <a
            href={quoteLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#07101F] transition hover:bg-blue-50"
          >
            Solicitar cotação <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 text-xs text-gray-500 sm:flex-row md:px-8">
          <span>© {new Date().getFullYear()} OHEL ON. Gestão eclesiástica.</span>
          <Link href="/login" className="text-gray-300 transition hover:text-white">Área Administrativa</Link>
        </div>
      </footer>
    </main>
  );
}
