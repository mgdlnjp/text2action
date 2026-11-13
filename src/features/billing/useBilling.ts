import { useCallback, useEffect, useState } from "react";
import type { AccessInfo, BillingConfig } from "../../../shared/billing";
import { useToast } from "../../components/Toast";
import { BillingError, fetchAccess, fetchBillingConfig, openBillingPortal, startCheckout } from "../../lib/billing";

/** État de l'abonnement côté interface : configuration, droits, actions Stripe. */
export function useBilling() {
  const toast = useToast();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchBillingConfig(), fetchAccess()])
      .then(([cfg, acc]) => {
        if (!alive) return;
        setConfig(cfg);
        setAccess(acc);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setRedirecting(true);
      try {
        await fn();
        // La page est redirigée vers Stripe : on garde l'état « redirection ».
      } catch (err) {
        setRedirecting(false);
        toast(err instanceof BillingError ? err.message : "Le paiement est momentanément indisponible.", "error");
      }
    },
    [toast],
  );

  return {
    config,
    access,
    setAccess,
    enabled: !!config?.enabled,
    paywallOpen,
    openPaywall: useCallback(() => setPaywallOpen(true), []),
    closePaywall: useCallback(() => setPaywallOpen(false), []),
    redirecting,
    upgrade: useCallback(() => run(startCheckout), [run]),
    manage: useCallback(() => run(openBillingPortal), [run]),
  };
}
