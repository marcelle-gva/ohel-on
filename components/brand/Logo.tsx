import Image from "next/image";

interface LogoProps {
  className?: string;
  noMask?: boolean; // <-- Adicionado aqui para o TypeScript parar de reclamar
}

export function Logo({ className = "h-[140px] w-[140px]", noMask = false }: LogoProps) {
  return (
    <div className={`group relative flex justify-center items-center ${className}`}>
      
      {/* Efeito de brilho de fundo (Neon) - Só aparece se noMask for falso */}
      {!noMask && (
        <div className="absolute inset-0 bg-ohel-blue rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
      )}

      <Image
        src="/logo.png"
        alt="OHEL ON Logo"
        fill
        sizes="200px"
        className="object-contain relative z-10 transition-all duration-500 group-hover:scale-105 drop-shadow-[0_0_12px_rgba(0,123,255,0.3)]"
        style={{ 
          // Se noMask for true, ele usa o modo normal (sem máscara). Se for false, usa o screen.
          mixBlendMode: noMask ? 'normal' : 'screen', 
          filter: 'brightness(1.3) contrast(1.2)' 
        }}
        priority
      />
    </div>
  );
}