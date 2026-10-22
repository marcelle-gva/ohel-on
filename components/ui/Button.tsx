import React, { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  // Trocamos o "w-full" por "" e deixamos o padding controlar o tamanho
  const baseStyles = "font-medium py-2.5 px-4 rounded-md transition-all duration-300 flex items-center justify-center gap-2 text-sm";
  
  const variants = {
    primary: "bg-ohel-blue hover:bg-blue-600 text-white shadow-[0_0_15px_rgba(0,123,255,0.2)]",
    secondary: "bg-transparent border border-gray-600/50 hover:bg-white/5 text-white",
    danger: "bg-red-500 hover:bg-red-600 text-white",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}