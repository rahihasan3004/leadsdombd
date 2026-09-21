import * as React from "react";
import { cn } from "@fine-leads/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm text-surface-900 placeholder:text-surface-400",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "focus-visible:outline-none focus-visible:border-[#14A800] focus-visible:ring-1 focus-visible:ring-[#14A800]",
          "dark:bg-surface-900 dark:border-surface-700",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;