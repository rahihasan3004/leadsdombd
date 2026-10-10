import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@fine-leads/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline:
          "border border-surface-300 bg-white hover:bg-surface-100 text-surface-700",
        secondary: "bg-surface-100 text-surface-900 hover:bg-surface-200",
        ghost: "hover:bg-surface-100 text-surface-700 hover:text-surface-900",
        link: "text-brand-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 sm:h-10 px-4 py-2",
        sm: "h-11 sm:h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function hasBusyIcon(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((child) => {
    if (
      !React.isValidElement<{ className?: string; children?: React.ReactNode }>(
        child,
      )
    )
      return false;
    return (
      /animate-spin/.test(child.props.className ?? "") ||
      hasBusyIcon(child.props.children)
    );
  });
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        disabled={props.disabled || props["aria-busy"] === true}
      >
        {asChild ? (
          // Slot must receive the child directly, without a spinner placeholder sibling.
          children
        ) : (
          <>
            {props["aria-busy"] === true && !hasBusyIcon(children) ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity=".25"
                />
                <path
                  d="M12 3a9 9 0 0 1 9 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
            ) : null}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
