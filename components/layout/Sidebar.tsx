"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, Wallet, Package, Church, BookOpen, Calendar, Settings, ChevronDown, X, MonitorPlay, Gift } from "lucide-react";
import { Logo } from "../brand/Logo";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  permissoes: string[];
}

export function Sidebar({ isOpen, setIsOpen, permissoes }: SidebarProps) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>("Secretaria");

  const toggleMenu = (name: string) => {
    setOpenMenu(openMenu === name ? null : name);
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
        { name: "Kids & Teens", href: "/secretaria/kids-teens", modulo: "kids-teens" },
        { name: "Congregados", href: "/secretaria/congregados", modulo: "congregados" },
        { name: "Visitantes", href: "/secretaria/visitantes", modulo: "visitantes" },
        { name: "Visitas", href: "/secretaria/visitas", modulo: "visitas" },
        { name: "Escalas", href: "/secretaria/escalas", modulo: "escalas" },
        { name: "Reuniões", href: "/secretaria/reunioes", modulo: "reunioes" },
        { name: "Mural", href: "/secretaria/mural", modulo: "mural" },
        { name: "Pedidos de Oração", href: "/secretaria/oracoes", modulo: "oracoes" },
        { name: "Cartas", href: "/secretaria/cartas", modulo: "cartas" },
        { name: "Certificados", href: "/secretaria/certificados", modulo: "certificados" },
        { name: "Credenciais", href: "/secretaria/credenciais", modulo: "credenciais" },
        { name: "Fichas", href: "/secretaria/fichas", modulo: "fichas" },
      ]
    },
    { name: "Financeiro", href: "/financeiro", icon: Wallet, modulo: "financeiro" },
    { name: "Patrimônio", href: "/patrimonio", icon: Package, modulo: "patrimonio" },
    { name: "Gabinete Pastoral", href: "/gabinete", icon: Church, modulo: "gabinete" },
    { name: "Ensino (EBD)", href: "/ensino", icon: BookOpen, modulo: "ensino" },
    { name: "Eventos", href: "/eventos", icon: Calendar, modulo: "eventos" },
    { name: "Sorteios", href: "/sorteios", icon: Gift, modulo: "sorteios" },
    { name: "Configurações", href: "/configuracoes", icon: Settings, modulo: "configuracoes" },
  ];

  // Filtra os menus principais
  const menusFiltrados = menuItems.filter(item => {
    // Se for a Secretaria (que tem submenus), verifica se tem permissão em PELO MENOS UM submenu
    if (item.subItems) {
      return item.subItems.some(sub => temPermissao(sub.modulo));
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
                        {item.subItems.filter(sub => temPermissao(sub.modulo)).map((sub) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.name}
                              href={sub.href}
                              onClick={() => { if (window.innerWidth < 768) setIsOpen(false); }}
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
