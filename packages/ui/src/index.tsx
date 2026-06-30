import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode
} from "react";
import { clsx } from "clsx";

export function Button({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return (
    <input
      className={clsx(
        "min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>): ReactNode {
  return <label className={clsx("text-sm font-medium text-slate-800", className)} {...props} />;
}
