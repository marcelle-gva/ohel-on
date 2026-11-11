import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "h-[140px] w-[140px]" }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState("/logo.png");

  useEffect(() => {
    let active = true;
    const carregarLogo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: usuario } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
      if (!usuario?.igreja_id) return;
      const { data: igreja } = await supabase.from("igrejas").select("logo_sistema_url").eq("id", usuario.igreja_id).maybeSingle();
      if (active && igreja?.logo_sistema_url) setLogoUrl(igreja.logo_sistema_url);
    };
    void carregarLogo();
    return () => { active = false; };
  }, []);

  return (
    <div className={`group relative flex justify-center items-center ${className}`}>
      {/* Efeito de brilho de fundo (Neon) */}
      <div className="absolute inset-0 bg-ohel-blue rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>

      <Image
        src={logoUrl}
        alt="OHEL ON Logo"
        fill
        sizes="200px"
        className="object-contain relative z-10 transition-all duration-500 group-hover:scale-105 drop-shadow-[0_0_12px_rgba(0,123,255,0.3)]"
        style={{ 
          mixBlendMode: 'screen', // Faz o fundo preto da imagem (se houver) desaparecer
          filter: 'brightness(1.3) contrast(1.2)' // Deixa a logo mais viva e nítida
        }}
        priority
      />
    </div>
  );
}
