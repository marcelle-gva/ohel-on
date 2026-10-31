"use client";

import { Input } from "@/components/ui/Input";
import { formatCurrencyInput } from "@/lib/currency";

interface CurrencyInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function CurrencyInput({
  label,
  name,
  value,
  onChange,
  placeholder = "0,00",
  className,
  required,
}: CurrencyInputProps) {
  return (
    <Input
      label={label}
      name={name}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(formatCurrencyInput(event.target.value))}
      placeholder={placeholder}
      className={className}
      required={required}
      autoComplete="off"
    />
  );
}
