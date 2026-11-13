import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-paper hover:bg-ink-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(21_20_15/0.2)] disabled:bg-ink/40",
  secondary:
    "bg-card text-ink border border-line hover:border-line-2 hover:bg-paper shadow-card disabled:text-faint",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink disabled:text-faint",
  danger: "text-rose-ink hover:bg-rose-soft disabled:text-faint",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-3.5 text-sm gap-2 rounded-[10px]",
  lg: "h-12 px-5 text-[15px] gap-2.5 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#15140F" />
        <path d="M8 11h9M8 16h6M8 21h4" stroke="#F6F5EF" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="m17 19 3 3 5-7"
          stroke="#D3F36A"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-[17px] font-semibold tracking-tight">
        text<span className="mark">2</span>action
      </span>
    </span>
  );
}

export function Badge({
  tone = "neutral",
  icon,
  children,
  title,
}: {
  tone?: "neutral" | "amber" | "moss" | "ink" | "rose";
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  const tones = {
    neutral: "bg-paper-2 text-ink-2 ring-line",
    amber: "bg-amber-soft text-amber-ink ring-amber-ink/15",
    moss: "bg-marker-soft text-moss ring-moss/15",
    ink: "bg-ink text-paper ring-ink",
    rose: "bg-rose-soft text-rose-ink ring-rose-ink/15",
  } as const;
  return (
    <span
      title={title}
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] leading-5 font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-white/20 bg-white/10 px-1 font-mono text-[11px] leading-4">
      {children}
    </kbd>
  );
}
