import React, { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div className={`glass-panel rounded-2xl p-8 ${className}`} {...props}>
      {children}
    </div>
  );
}