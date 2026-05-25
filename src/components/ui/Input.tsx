import * as React from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-text-subtle " +
  "transition-colors duration-100 hover:border-border-strong focus:border-primary focus:outline-none " +
  "disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, "h-9", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "py-2 resize-y min-h-[72px]")} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, "h-9 pr-8 appearance-none bg-[length:14px] bg-[right_10px_center] bg-no-repeat", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B6862' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded-sm border border-border-strong text-primary accent-[var(--primary)] cursor-pointer",
        className
      )}
      {...props}
    />
  )
);
Checkbox.displayName = "Checkbox";
