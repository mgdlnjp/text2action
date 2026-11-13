import { useEffect, useRef, useState } from "react";
import { AlertOctagon, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { activateSubscription, BillingError } from "../lib/billing";
import { Link, useDocumentTitle } from "../lib/router";

type Status = { kind: "loading" } | { kind: "success" } | { kind: "error"; message: string };

export function BillingSuccess() {
  useDocumentTitle("Abonnement — Text2Action");
  const [sessionId] = useState(() => new URLSearchParams(window.location.search).get("session_id"));
  const [status, setStatus] = useState<Status>(() =>
    sessionId ? { kind: "loading" } : { kind: "error", message: "Le lien de confirmation est incomplet." },
  );
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !sessionId) return;
    started.current = true;
    activateSubscription(sessionId)
      .then(() => setStatus({ kind: "success" }))
      .catch((err) =>
        setStatus({
          kind: "error",
          message: err instanceof BillingError ? err.message : "L'activation a échoué. Réessayez dans un instant.",
        }),
      );
  }, [sessionId]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-md text-center" aria-live="polite">
          {status.kind === "loading" && (
            <>
              <Loader2 className="mx-auto size-10 animate-spin text-moss" aria-hidden />
              <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">Activation de votre abonnement…</h1>
              <p className="mt-2 text-muted">Nous vérifions le paiement auprès de Stripe.</p>
            </>
          )}
          {status.kind === "success" && (
            <>
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-marker">
                <CheckCircle2 className="size-7 text-ink" aria-hidden />
              </span>
              <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Bienvenue dans Text2Action Pro</h1>
              <p className="mt-3 text-muted">
                Vos extractions sont désormais illimitées sur ce navigateur. Vous pouvez gérer ou résilier votre
                abonnement à tout moment depuis l'outil.
              </p>
              <Link
                href="/app"
                className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 font-medium text-paper transition-colors hover:bg-ink-2"
              >
                Ouvrir l'outil
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          )}
          {status.kind === "error" && (
            <>
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-soft">
                <AlertOctagon className="size-7 text-rose-ink" aria-hidden />
              </span>
              <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
                L'abonnement n'a pas pu être activé
              </h1>
              <p role="alert" className="mt-3 text-ink-2">
                {status.message}
              </p>
              <p className="mt-2 text-sm text-faint">
                Si vous avez été débité, rechargez cette page dans quelques secondes. Si le problème persiste,
                contactez-nous avec votre reçu Stripe.
              </p>
              <Link href="/app" className="mt-8 inline-flex font-medium underline underline-offset-4">
                Retour à l'outil
              </Link>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
