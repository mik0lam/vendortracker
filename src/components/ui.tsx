import type { ReactNode } from "react";
import Link from "next/link";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6 ${
        hover ? "transition hover:border-primary/20 hover:shadow-[var(--shadow-md)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "indigo" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    default: "from-slate-50 to-white border-slate-200/80",
    indigo: "from-indigo-50/80 to-white border-indigo-100",
    emerald: "from-emerald-50/80 to-white border-emerald-100",
    amber: "from-amber-50/80 to-white border-amber-100",
    violet: "from-violet-50/80 to-white border-violet-100",
  };
  const iconTones = {
    default: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    violet: "bg-violet-100 text-violet-600",
  };

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-5 shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)] ${tones[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTones[tone]}`}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const styles = {
    primary:
      "bg-primary text-white shadow-sm shadow-indigo-500/25 hover:bg-primary-hover hover:shadow-md hover:shadow-indigo-500/30",
    secondary:
      "border border-border bg-white text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50",
    danger:
      "bg-danger text-white shadow-sm shadow-red-500/20 hover:bg-red-700 hover:shadow-md",
    ghost: "text-muted hover:bg-slate-100 hover:text-foreground",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const styles = {
    primary:
      "bg-primary text-white shadow-sm shadow-indigo-500/25 hover:bg-primary-hover",
    secondary:
      "border border-border bg-white text-foreground shadow-sm hover:bg-slate-50",
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${styles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm transition placeholder:text-muted-foreground/70 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm transition outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm transition placeholder:text-muted-foreground/70 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 ${className}`}
      {...props}
    />
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-foreground/90"
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "muted" | "warning" | "indigo";
}) {
  const styles = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-success-soft text-success",
    muted: "bg-slate-100 text-muted",
    warning: "bg-accent-soft text-amber-700",
    indigo: "bg-primary-soft text-indigo-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  message,
  icon,
}: {
  message: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card-muted/50 px-6 py-14 text-center">
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-muted">
          {icon}
        </div>
      ) : null}
      <p className="max-w-sm text-sm text-muted">{message}</p>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`border-b border-border bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-border/60 px-4 py-3.5 align-middle last:border-b-0 ${className}`}
    >
      {children}
    </td>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return (
    <tr className="transition hover:bg-slate-50/60">{children}</tr>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <div className="flex rounded-xl border border-border bg-slate-100/80 p-1">
      <input type="hidden" name={name} value={value} />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            value === opt.value
              ? "bg-white text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card className="mb-5 !p-4">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </Card>
  );
}

export function ExportLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary-soft/40 hover:text-primary"
    >
      {children}
    </a>
  );
}
