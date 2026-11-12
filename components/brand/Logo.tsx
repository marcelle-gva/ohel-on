"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "h-[140px] w-[140px]" }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState("/ipo-cloud-art.png");

  useEffect(() => {
    let active = true;
    const carregarLogo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: platformAdmin } = await supabase.from("ipocloud_platform_admins").select("logo_url").eq("auth_user_id", session.user.id).eq("ativo", true).maybeSingle();
      if (active && platformAdmin?.logo_url) {
        setLogoUrl(platformAdmin.logo_url);
        return;
      }
      const { data: usuario } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
      if (!usuario?.igreja_id) return;
      const { data: igreja } = await supabase.from("igrejas").select("logo_sistema_url").eq("id", usuario.igreja_id).maybeSingle();
      if (active && igreja?.logo_sistema_url) setLogoUrl(igreja.logo_sistema_url);
    };
    void carregarLogo();
    const refresh = () => void carregarLogo();
    window.addEventListener("ohel:logo-atualizada", refresh);
    return () => { active = false; window.removeEventListener("ohel:logo-atualizada", refresh); };
  }, []);

  return (
    <div className={`relative flex justify-center items-center overflow-visible ${className}`}>
      <Image
        src={logoUrl}
        alt="IPO CLOUD"
        fill
        sizes="200px"
        className="relative z-10 object-contain"
        priority
      />
    </div>
  );
}
