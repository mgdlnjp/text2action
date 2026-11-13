import { Loader2, Settings2, Sparkles } from "lucide-react";
import type { AccessInfo } from "../../../shared/billing";

interface Props {
  access: AccessInfo | null;
  redirecting: boolean;
  onUpgrade: () => void;
  onManage: () => void;
}

/** Indicateur compact du forfait : quota gratuit restant ou statut Pro. */
export function PlanBar({ access, redirecting, onUpgrade, onManage }: Props) {
  if (!access || access.plan === "open") return null;

  if (access.plan === "pro") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-0.5 text-[12px] font-semibold text-marker">
          <Sparkles className="size-3" aria-hidden />
          Pro
        </span>
        <button
          type="button"
          onClick={onManage}
          disabled={redirecting}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-60"
        >
          {redirecting ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Settings2 className="size-3.5" aria-hidden />
          )}
          Gérer l'abonnement
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onUpgrade}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-marker px-2.5 text-[13px] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-[#c5ea4f]"
      >
        <Sparkles className="size-3.5" aria-hidden />
        Passer à Pro
      </button>
    </div>
  );
}
