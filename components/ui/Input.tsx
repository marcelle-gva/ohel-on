import React, { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`input-ohel w-full px-4 py-3 rounded-lg text-sm ${className}`}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";