import { useEffect, useRef } from "react";
import { ArrowRight, Check, Loader2, Lock, X } from "lucide-react";
import { formatAmount, formatPrice, type BillingConfig } from "../../../shared/billing";
import { Button } from "../../components/ui";
import { PRO_FEATURES } from "./features";

interface Props {
  open: boolean;
  config: BillingConfig | null;
  quotaReached: boolean;
  redirecting: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export function PaywallModal({ open, config, quotaReached, redirecting, onClose, onUpgrade }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open || !config?.enabled || !config.price) return null;
  const price = config.price;
  const period = formatPrice(price).split(" / ")[1];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="animate-rise relative w-full max-w-md overflow-hidden rounded-t-3xl bg-card shadow-lift sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper-2 hover:text-ink"
          aria-label="Fermer"
        >
          <X className="size-4" aria-hidden />
        </button>

        <div className="grain border-b border-line bg-paper px-6 pt-7 pb-6 sm:px-8">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-ink text-marker">
            <Lock className="size-[18px]" aria-hidden />
          </span>
          <h2 id="paywall-title" className="mt-4 font-display text-2xl leading-tight font-semibold tracking-tight">
            {quotaReached ? "Vos extractions gratuites sont épuisées" : "Passez à Text2Action Pro"}
          </h2>
          <p className="mt-1.5 text-[15px] text-muted">
            {quotaReached
              ? "Pour continuer dès maintenant, passez à l’accès illimité :"
              : "Toutes vos listes d'actions, sans compter."}
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-semibold tracking-tight">{formatAmount(price)}</span>
            <span className="text-muted">/ {period}</span>
          </p>
          <ul className="mt-5 grid gap-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-[15px] text-ink-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-marker-soft text-moss">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <Button
            data-autofocus
            variant="primary"
            size="lg"
            className="mt-7 w-full"
            disabled={redirecting}
            onClick={onUpgrade}
            icon={redirecting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
          >
            {redirecting ? (
              "Redirection vers le paiement…"
            ) : (
              <>
                S'abonner — {formatPrice(price)}
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-[12px] text-faint">
            Paiement sécurisé par Stripe. Text2Action n'a jamais accès à vos coordonnées bancaires.
          </p>
        </div>
      </div>
    </div>
  );
}
