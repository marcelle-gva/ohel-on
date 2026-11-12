import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Church,
  CircleDollarSign,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  MonitorPlay,
  ShieldCheck,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const quoteLink = `https://wa.me/5521996288956?text=${encodeURIComponent("Olá! Quero solicitar uma cotação do sistema OHEL ON.")}`;

const highlights = [
  { icon: UsersRound, title: "Pessoas e secretaria" },
  { icon: CalendarDays, title: "Eventos e escalas" },
  { icon: CircleDollarSign, title: "Gestão financeira" },
  { icon: BarChart3, title: "Relatórios e indicadores" },
  { icon: MessageCircle, title: "Comunicação integrada" },
];

const modules = [
  { icon: UsersRound, title: "Pessoas e secretaria", description: "Membros, visitantes e congregações organizados em um só lugar." },
  { icon: Wallet, title: "Financeiro", description: "Movimentos, categorias e uma visão mais clara dos recursos da igreja." },
  { icon: CalendarDays, title: "Eventos e escalas", description: "Inscrições, sorteios e equipes com menos improviso na rotina." },
  { icon: BookOpen, title: "Cultos e ensino", description: "Louvores, avisos, pedidos de oração e recursos para o culto." },
  { icon: MonitorPlay, title: "Monitor de mídia", description: "Apoio visual para visitantes, repertório, palavra e transmissão." },
  { icon: MessageCircle, title: "WhatsApp integrado", description: "Comunicação mais próxima com membros, visitantes e equipes." },
];

const differences = [
  "Plataforma em nuvem segura e estável",
  "Integração entre setores e departamentos",
  "Acesso facilitado e controle de permissões",
  "Suporte especializado para a rotina da igreja",
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const oauthKeys = ["code", "state", "error", "error_description", "error_code"];
  if (oauthKeys.some((key) => params[key])) {
    const callbackParams = new URLSearchParams();
    for (const key of oauthKeys) {
      const value = params[key];
      if (Array.isArray(value)) value.forEach((item) => callbackParams.append(key, item));
      else if (value) callbackParams.set(key, value);
    }
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020812] text-white selection:bg-cyan-400/30">
      <header className="sticky top-0 z-40 border-b border-cyan-300/10 bg-[#020812]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-5 px-5 md:px-8">
          <Link href="#inicio" aria-label="IPO CLOUD - início" className="shrink-0">
            <Logo className="h-12 w-28 md:h-14 md:w-36" />
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-gray-300 lg:flex">
            <a href="#inicio" className="rounded-full border border-cyan-300/70 bg-cyan-400/10 px-5 py-2 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.2)]">Início</a>
            <a href="#solucoes" className="rounded-full px-4 py-2 transition hover:text-cyan-200">Soluções <span className="text-xs">⌄</span></a>
            <a href="#sobre" className="rounded-full px-4 py-2 transition hover:text-cyan-200">Sobre</a>
            <a href="#planos" className="rounded-full px-4 py-2 transition hover:text-cyan-200">Planos</a>
            <a href="#contato" className="rounded-full px-4 py-2 transition hover:text-cyan-200">Contato</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden items-center gap-2 rounded-full border border-cyan-200/70 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-400/10 sm:flex">
              <LockKeyhole className="h-3.5 w-3.5 text-cyan-300" /> Acessar sistema
            </Link>
            <Link href="/login" aria-label="Acessar sistema" className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-200/60 text-cyan-200 sm:hidden"><LockKeyhole className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      <section id="inicio" className="relative isolate overflow-hidden border-b border-cyan-300/10">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute right-0 top-0 h-[34rem] w-[34rem] rounded-full bg-cyan-400/10 blur-[140px]" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent shadow-[0_0_24px_rgba(34,211,238,0.7)]" />
          <div className="absolute -right-24 top-24 h-[32rem] w-[58rem] rotate-[-18deg] rounded-[50%] border border-cyan-300/15" />
          <div className="absolute -right-40 top-40 h-[30rem] w-[58rem] rotate-[-18deg] rounded-[50%] border border-blue-400/10" />
        </div>
        <div className="mx-auto grid min-h-[600px] max-w-7xl items-center gap-10 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:py-24">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200">Gestão eclesiástica inteligente</p>
            <h1 className="mt-6 text-5xl font-bold leading-[1.03] tracking-tight text-white sm:text-6xl">Mais cuidado<br />com pessoas.</h1>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-cyan-300 sm:text-4xl">Mais clareza na gestão.</h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-gray-300 md:text-lg">Tecnologia, organização e comunicação integradas para fortalecer a gestão da sua igreja.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={quoteLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-300 px-6 py-3.5 text-sm font-bold text-[#03101c] shadow-[0_0_28px_rgba(34,211,238,0.55)] transition hover:-translate-y-0.5 hover:bg-cyan-200">Conhecer a plataforma <ArrowRight className="h-4 w-4" /></a>
              <Link href="/login" className="inline-flex items-center justify-center rounded-full border border-white/60 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-cyan-300 hover:bg-cyan-300/10">Acessar sistema</Link>
            </div>
          </div>
          <div className="relative flex min-h-[360px] items-center justify-center lg:min-h-[500px]">
            <div aria-hidden="true" className="absolute h-[22rem] w-[22rem] rounded-full bg-blue-500/20 blur-[100px] sm:h-[30rem] sm:w-[30rem]" />
            <div className="relative flex h-[360px] w-full max-w-[560px] items-center justify-center rounded-[3rem] border border-cyan-300/15 bg-[#061323]/45 shadow-[0_0_80px_rgba(0,119,255,0.2)] backdrop-blur-sm sm:h-[440px]">
              <div className="absolute inset-8 rounded-full border border-cyan-300/20 shadow-[0_0_35px_rgba(34,211,238,0.18)]" />
              <div className="absolute inset-14 rounded-full border border-blue-400/15" />
              <Image src="/ipo-cloud-art.png" alt="IPO CLOUD" width={1535} height={1024} priority className="relative z-10 h-auto w-[82%] object-contain drop-shadow-[0_0_28px_rgba(0,170,255,0.7)]" />
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Possibilidades da plataforma" className="relative z-10 mx-auto -mt-1 max-w-6xl px-5 md:px-8">
        <div className="grid overflow-hidden rounded-2xl border border-cyan-200/20 bg-[#071727]/90 shadow-[0_0_35px_rgba(0,104,180,0.22)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-6">
          <div className="flex items-center justify-center p-5 text-center sm:col-span-2 lg:col-span-1 lg:text-left"><p className="text-lg font-bold leading-tight">Uma plataforma.<br /><span className="text-cyan-300">Várias possibilidades.</span></p></div>
          {highlights.map(({ icon: Icon, title }) => <div key={title} className="flex items-center justify-center gap-2 border-t border-cyan-200/15 p-4 text-center text-xs text-gray-200 sm:border-l lg:border-t-0"><Icon className="h-7 w-7 shrink-0 text-cyan-300" /><span>{title}</span></div>)}
        </div>
      </section>

      <section id="solucoes" className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#061323] shadow-[0_0_45px_rgba(0,117,255,0.2)]">
          <Image src="/ipo-cloud-logo.png" alt="OHEL ON e IPO CLOUD conectados" width={1672} height={941} className="h-auto w-full object-cover" sizes="(max-width: 1024px) 100vw, 55vw" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Diferenciais que fazem a diferença</p>
          <h2 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl">Uma gestão mais clara para cuidar melhor.</h2>
          <p className="mt-5 text-sm leading-7 text-gray-300 md:text-base">O OHEL ON nasceu da necessidade real de uma gestão mais completa. O IPO CLOUD amplia essa visão com uma plataforma segura, conectada e feita para a realidade das igrejas.</p>
          <ul className="mt-7 space-y-4">{differences.map((difference) => <li key={difference} className="flex items-center gap-3 text-sm text-gray-200"><Check className="h-5 w-5 shrink-0 text-cyan-300" />{difference}</li>)}</ul>
        </div>
      </section>

      <section id="sobre" className="border-y border-cyan-300/10 bg-[#03101d]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Nossa origem</p>
            <h2 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl">Tecnologia que nasceu para servir.</h2>
          </div>
          <div className="space-y-5 text-sm leading-7 text-gray-300 md:text-base"><p>O IPO CLOUD nasceu de uma necessidade real da Igreja Pentecostal Ohel: unir fé, tecnologia e propósito em uma gestão mais eficiente.</p><p>Hoje, essa solução está pronta para atender outras igrejas e organizações com ferramentas que aproximam pessoas, organizam equipes e apoiam o cuidado diário.</p><p className="border-l-2 border-cyan-300 pl-4 font-semibold text-cyan-100">Tecnologia compartilhada, igrejas conectadas e inovação em favor do Reino.</p></div>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-5 py-20 md:px-8 lg:py-24">
        <div className="mb-10 text-center"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Planos flexíveis</p><h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Uma solução para cada realidade.</h2><p className="mx-auto mt-4 max-w-2xl text-sm text-gray-400">Converse com nossa equipe para encontrar o formato ideal para sua igreja ou organização.</p></div>
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          {[{ title: "Igreja individual", text: "Tudo o que você precisa para começar.", icon: Church }, { title: "Rede ou organização", text: "Recursos para uma gestão ainda mais ampla.", icon: UsersRound }].map(({ title, text, icon: Icon }) => <article key={title} className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#0a2033] to-[#06101d] p-6 shadow-[0_0_30px_rgba(0,142,210,0.12)]"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300"><Icon className="h-6 w-6" /></div><h3 className="text-lg font-bold text-white">{title}</h3></div><p className="mt-5 text-sm text-gray-400">{text}</p><a href={quoteLink} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-full bg-cyan-100 px-5 py-2.5 text-xs font-bold text-[#06101d] transition hover:bg-white">Conhecer plano <ArrowRight className="h-3.5 w-3.5" /></a></article>)}
        </div>
      </section>

      <section id="contato" className="px-5 pb-16 md:px-8 md:pb-20">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 rounded-3xl border border-cyan-300/25 bg-gradient-to-r from-[#08243a] via-[#071827] to-[#08243a] p-7 shadow-[0_0_40px_rgba(0,174,255,0.16)] md:flex-row md:p-9"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-300"><MessageCircle className="h-6 w-6" /></div><div><h2 className="text-lg font-bold text-white">Fale conosco</h2><p className="mt-1 text-sm text-gray-400">Solicite uma demonstração ou tire suas dúvidas.</p></div></div><a href={quoteLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-[#03101c] shadow-[0_0_25px_rgba(34,211,238,0.45)] transition hover:bg-cyan-200">Entrar em contato <ArrowRight className="h-4 w-4" /></a></div>
      </section>

      <footer className="border-t border-cyan-300/10 bg-[#020812]"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-gray-500 sm:flex-row md:px-8"><div className="flex items-center gap-4"><Logo className="h-10 w-28" /><span>Tecnologia a serviço de pessoas e organizações</span></div><Link href="/login" className="text-gray-300 transition hover:text-cyan-200">Acessar sistema</Link></div></footer>
    </main>
  );
}
