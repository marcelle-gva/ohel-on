"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, Wallet, Package, Church, BookOpen, Calendar, Settings, ChevronDown, X, MonitorPlay, Baby, MessageCircle, FileBarChart, Building2 } from "lucide-react";
import { Logo } from "../brand/Logo";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  permissoes: string[];
  isAdmin: boolean;
}

const getMenuForPath = (path: string) => {
  const sections = [
    ["Secretaria", "/secretaria"],
    ["Financeiro", "/financeiro"],
    ["Patrimônio", "/patrimonio"],
    ["Gabinete Pastoral", "/gabinete"],
    ["Ensino (EBD)", "/ensino"],
    ["Departamento Infantil", "/infantil"],
    ["Comunicações", "/comunicacoes"],
    ["Eventos", "/eventos"],
    ["Configurações", "/configuracoes"],
  ] as const;
  return sections.find(([, prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[0] ?? null;
};

export function Sidebar({ isOpen, setIsOpen, permissoes, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const [menuOverride, setMenuOverride] = useState<{ pathname: string; menu: string | null } | null>(null);
  const openMenu = menuOverride?.pathname === pathname ? menuOverride.menu : getMenuForPath(pathname);

  const toggleMenu = (name: string) => {
    setMenuOverride({ pathname, menu: openMenu === name ? null : name });
  };

  // Função auxiliar para verificar se tem permissão
  const temPermissao = (modulo: string) => permissoes.includes(modulo);

  const menuItems = [
    { 
      name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, modulo: "dashboard"
    },
    { 
      name: "Monitor de Mídia", href: "/monitor-midia", icon: MonitorPlay, modulo: "monitor-midia"
    },
    { 
      name: "Secretaria", icon: Users, 
      subItems: [
        { name: "Congregações", href: "/secretaria/congregacoes", modulo: "congregacoes" },
        { name: "Membros", href: "/secretaria/membros", modulo: "membros" },
        { name: "Congregados", href: "/secretaria/congregados", modulo: "congregados" },
        { name: "Visitantes", href: "/secretaria/visitantes", modulo: "visitantes" },
        { name: "Orações", href: "/secretaria/oracoes", modulo: "oracoes" },
        { name: "Mural", href: "/secretaria/mural", modulo: "mural" },
        { name: "Escalas", href: "/secretaria/escalas", modulo: "escalas" },
        { name: "Reuniões", href: "/secretaria/reunioes", modulo: "reunioes" },
        { name: "Visitas", href: "/secretaria/visitas", modulo: "visitas" },
        { name: "Fichas", href: "/secretaria/fichas", modulo: "fichas" },
        { name: "Cartas", href: "/secretaria/cartas", modulo: "cartas" },
        { name: "Certificados", href: "/secretaria/certificados", modulo: "certificados" },
        { name: "Credenciais", href: "/secretaria/credenciais", modulo: "credenciais" },
      ]
    },
    {
      name: "Financeiro", href: "/financeiro", icon: Wallet, modulo: "financeiro",
      subItems: [
        { name: "Visão Geral", href: "/financeiro", modulo: "financeiro" },
        { name: "Movimento Financeiro", href: "/financeiro/movimento", modulo: "financeiro" },
        { name: "Importar OFX", href: "/financeiro/movimento/importar", modulo: "financeiro" },
        { name: "Caixas e Bancos", href: "/financeiro/caixas", modulo: "financeiro" },
        { name: "Contas a Pagar", href: "/financeiro/contas-pagar", modulo: "financeiro" },
        { name: "Fornecedores", href: "/financeiro/fornecedores", modulo: "financeiro" },
        { name: "Relatórios", href: "/financeiro/relatorios", modulo: "financeiro" },
      ],
    },
    {
      name: "Patrimônio", icon: Package, modulo: "patrimonio",
      subItems: [
        { name: "Visão Geral", href: "/patrimonio", modulo: "patrimonio" },
        { name: "Novo Bem", href: "/patrimonio/novo", modulo: "patrimonio" },
        { name: "Inventário", href: "/patrimonio/inventario", modulo: "patrimonio" },
        { name: "Movimentações", href: "/patrimonio/movimentacoes", modulo: "patrimonio" },
      ],
    },
    {
      name: "Gabinete Pastoral", icon: Church, modulo: "gabinete",
      subItems: [
        { name: "Visão Geral", href: "/gabinete", modulo: "gabinete" },
        { name: "Atendimentos", href: "/gabinete/atendimentos", modulo: "gabinete" },
        { name: "Novo Atendimento", href: "/gabinete/atendimentos/novo", modulo: "gabinete" },
        { name: "Acompanhamento Emocional", href: "/gabinete/emocional", modulo: "gabinete" },
        { name: "Comunicações", href: "/gabinete/comunicacoes", modulo: "gabinete" },
        { name: "Nova Comunicação", href: "/gabinete/comunicacoes/nova", modulo: "gabinete" },
        { name: "Banco de Sermões", href: "/gabinete/sermoes", modulo: "gabinete" },
        { name: "Novo Sermão", href: "/gabinete/sermoes/novo", modulo: "gabinete" },
      ],
    },
    {
      name: "Ensino (EBD)", icon: BookOpen, modulo: "ensino",
      subItems: [
        { name: "Visão Geral", href: "/ensino", modulo: "ensino" },
        { name: "Classes", href: "/ensino/classes", modulo: "ensino" },
        { name: "Nova Classe", href: "/ensino/classes/nova", modulo: "ensino" },
        { name: "Matrículas", href: "/ensino/matriculas", modulo: "ensino" },
        { name: "Diário de Classe", href: "/ensino/diario", modulo: "ensino" },
        { name: "Certificados", href: "/ensino/certificados", modulo: "ensino" },
      ],
    },
    {
      name: "Departamento Infantil", icon: Baby, modulo: "infantil",
      subItems: [
        { name: "Painel Kids", href: "/infantil", modulo: "infantil" },
      ],
    },
    {
      name: "Comunicações", icon: MessageCircle, modulo: "comunicacoes",
      subItems: [
        { name: "Central de Comunicações", href: "/comunicacoes", modulo: "comunicacoes" },
      ],
    },
    { name: "Gerador de Relatórios", href: "/relatorios", icon: FileBarChart, modulo: "relatorios" },
    { name: "Administração da Plataforma", href: "/plataforma", icon: Building2, modulo: "plataforma", adminOnly: true },
    {
      name: "Eventos", icon: Calendar, modulo: "eventos",
      subItems: [
        { name: "Visão Geral", href: "/eventos", modulo: "eventos" },
        { name: "Novo Evento", href: "/eventos/novo", modulo: "eventos" },
        { name: "Inscrições", href: "/eventos/inscricoes", modulo: "eventos" },
      ],
    },
    {
      name: "Configurações", href: "/configuracoes", icon: Settings, modulo: "configuracoes",
      subItems: [
        { name: "Visão Geral", href: "/configuracoes", modulo: "configuracoes" },
        { name: "Cadastros Financeiros", href: "/configuracoes/cadastros-financeiros", modulo: "configuracoes" },
        { name: "Cadastros do Patrimônio", href: "/configuracoes/cadastros-patrimonio", modulo: "configuracoes" },
        { name: "Grupos e Permissões", href: "/configuracoes/grupos", modulo: "configuracoes", adminOnly: true },
        { name: "Usuários", href: "/configuracoes/usuarios", modulo: "configuracoes", adminOnly: true },
        { name: "Segurança da Conta", href: "/configuracoes/seguranca", modulo: "configuracoes" },
        { name: "Check-in", href: "/configuracoes/checkin", modulo: "configuracoes" },
        { name: "QR Code de Check-in", href: "/configuracoes/checkin/qrcode", modulo: "configuracoes" },
        { name: "Instância WhatsApp", href: "/configuracoes/comunicacoes", modulo: "configuracoes", adminOnly: true },
      ],
    },
  ];

  // Filtra os menus principais
  const menusFiltrados = menuItems.filter(item => {
    if ("adminOnly" in item && item.adminOnly && !isAdmin) return false;
    // Se for a Secretaria (que tem submenus), verifica se tem permissão em PELO MENOS UM submenu
    if (item.subItems) {
      return item.subItems.some(sub => temPermissao(sub.modulo) && (!("adminOnly" in sub) || !sub.adminOnly || isAdmin));
    }
    return temPermissao(item.modulo);
  });

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-ohel-surface border-r border-gray-800 flex flex-col h-full transition-transform duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        
        <div className="h-20 flex items-center justify-between px-4 border-b border-gray-800/50">
          <div className="scale-75">
            <Logo />
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
          {menusFiltrados.map((item) => {
            // Lógica para ver se o item está ativo
            const isActive = item.href 
              ? pathname.startsWith(item.href) 
              : item.subItems?.some(sub => pathname.startsWith(sub.href));
            
            const Icon = item.icon;

            return (
              <div key={item.name}>
                {item.subItems ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive && openMenu !== item.name ? "bg-ohel-blue/10 text-ohel-blue" : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isActive ? "text-ohel-blue" : "text-gray-500"}`} />
                        {item.name}
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${openMenu === item.name ? "rotate-180" : ""}`} />
                    </button>

                    {openMenu === item.name && (
                      <div className="ml-9 mt-1 flex flex-col gap-1 border-l border-gray-700/50 pl-2">
                        {item.subItems.filter(sub => temPermissao(sub.modulo) && (!("adminOnly" in sub) || !sub.adminOnly || isAdmin)).map((sub) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.name}
                              href={sub.href}
                              onClick={() => {
                                setMenuOverride({ pathname, menu: item.name });
                                if (window.innerWidth < 768) setIsOpen(false);
                              }}
                              className={`py-2 px-3 rounded-lg text-sm transition-all ${
                                isSubActive ? "text-ohel-blue bg-ohel-blue/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              {sub.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href!}
                    onClick={() => { if (window.innerWidth < 768) setIsOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive ? "bg-ohel-blue/10 text-ohel-blue" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-ohel-blue" : "text-gray-500"}`} />
                    {item.name}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}