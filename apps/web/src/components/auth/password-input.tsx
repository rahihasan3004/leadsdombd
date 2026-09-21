"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
}

export function PasswordInput({
  placeholder = "Enter your password",
  className,
  ...props
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        className={`h-11 w-full rounded-md border border-surface-200 bg-white px-3.5 pr-10 text-sm text-surface-900 placeholder:text-surface-400 focus:border-surface-950 focus:ring-1 focus:ring-surface-950 transition-all outline-none ${className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700 cursor-pointer"
        tabIndex={-1}
      >
        {show ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}