import { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";
import { DEFAULT_MAX_TEXT_CHARS, type HealthInfo, type SourceType } from "../../shared/schema";
import { SiteHeader } from "../components/SiteChrome";
import { ApiError, extractActions, fetchHealth } from "../lib/api";
import { useDocumentTitle } from "../lib/router";
import { SAMPLES } from "../lib/samples";
import { ResultPanel, type ResultState } from "../features/workspace/ResultPanel";
import { SourcePanel } from "../features/workspace/SourcePanel";
import { useTaskList } from "../features/workspace/useTaskList";
import { PaywallModal } from "../features/billing/PaywallModal";
import { PlanBar } from "../features/billing/PlanBar";
import { useBilling } from "../features/billing/useBilling";

export function Workspace() {
  useDocumentTitle(
    "Extraire les actions d'un texte — Text2Action",
    "Collez votre email, compte rendu ou vos notes et obtenez une liste d'actions vérifiable, exportable en Markdown ou CSV.",
  );

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [text, setText] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("email");
  const [context, setContext] = useState("");
  const [state, setState] = useState<ResultState>({ status: "idle" });
  const { tasks, counts, set, clear, toggle, update, remove } = useTaskList();
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const billing = useBilling();
  const { setAccess, openPaywall } = billing;
  const [quotaReached, setQuotaReached] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal)
      .then(setHealth)
      .catch(() => {});
    return () => {
      ctrl.abort();
      abortRef.current?.abort();
    };
  }, []);

  const submit = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ status: "loading" });
    clear();
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    try {
      const result = await extractActions({ text, sourceType, context }, ctrl.signal);
      set(result.tasks);
      if (result.access) setAccess(result.access);
      setState({
        status: "done",
        meta: { mode: result.mode, noTaskReason: result.noTaskReason, warnings: result.warnings },
      });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      if (err instanceof ApiError && err.code === "QUOTA_EXCEEDED") {
        if (err.access) setAccess(err.access);
        setQuotaReached(true);
        openPaywall();
      }
      setState({
        status: "error",
        message: err instanceof ApiError ? err.message : "Une erreur inattendue est survenue.",
      });
    }
  }, [text, sourceType, context, set, clear, setAccess, openPaywall]);

  /** Efface immédiatement le texte, le contexte et le résultat de l'écran. */
  const clearAll = useCallback(() => {
    abortRef.current?.abort();
    setText("");
    setContext("");
    clear();
    setState({ status: "idle" });
    textareaRef.current?.focus();
  }, [clear]);

  const loadSample = () => {
    setText(SAMPLES[sourceType]);
    textareaRef.current?.focus();
  };

  const maxChars = health?.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <SiteHeader compact />
      {health?.mode === "demo" && (
        <div className="border-b border-moss/15 bg-marker-soft">
          <p className="mx-auto flex max-w-[1400px] items-start gap-2 px-4 py-2 text-[13px] text-moss sm:items-center sm:px-6">
            <FlaskConical className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden />
            <span>
              <strong className="font-semibold">Mode démo</strong> — l'extraction utilise des règles simples, sans IA.
              Les résultats sont indicatifs et moins complets qu'en mode IA.
            </span>
          </p>
        </div>
      )}
      {billing.enabled && billing.access && billing.access.plan !== "open" && (
        <div className="border-b border-line/70">
          <div className="mx-auto flex max-w-[1400px] items-center justify-end px-4 py-2 sm:px-6">
            <PlanBar
              access={billing.access}
              redirecting={billing.redirecting}
              onUpgrade={() => {
                setQuotaReached(false);
                billing.openPaywall();
              }}
              onManage={billing.manage}
            />
          </div>
        </div>
      )}
      <PaywallModal
        open={billing.paywallOpen}
        config={billing.config}
        quotaReached={quotaReached}
        redirecting={billing.redirecting}
        onClose={billing.closePaywall}
        onUpgrade={billing.upgrade}
      />
      <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-4 py-6 sm:px-6 lg:min-h-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10 lg:py-8">
        <SourcePanel
          ref={textareaRef}
          text={text}
          sourceType={sourceType}
          context={context}
          maxChars={maxChars}
          loading={state.status === "loading"}
          health={health}
          onText={setText}
          onSourceType={setSourceType}
          onContext={setContext}
          onSubmit={submit}
          onSample={loadSample}
          onClear={clearAll}
        />
        <div ref={resultRef} className="scroll-mt-20 lg:-mr-3 lg:min-h-0 lg:overflow-y-auto lg:pr-3 lg:pb-4">
          <ResultPanel
            state={state}
            tasks={tasks}
            counts={counts}
            onToggle={toggle}
            onUpdate={update}
            onDelete={remove}
            onRetry={submit}
            onRestart={clearAll}
          />
        </div>
      </main>
    </div>
  );
}
