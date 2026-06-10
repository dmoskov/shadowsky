import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "asph-button-primary",
  secondary: "asph-button-secondary",
  ghost: "asph-button-ghost",
  danger: "asph-button bg-asph-error text-white hover:opacity-90",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", type = "button", className = "", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`${variantClasses[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
        {...props}
      />
    );
  },
);
