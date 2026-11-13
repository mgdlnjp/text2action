import { forwardRef, useId } from "react";
import { Eraser, FileText, Mail, NotebookPen, ShieldCheck, Sparkles, Users, Wand2 } from "lucide-react";
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, MAX_CONTEXT_CHARS, type HealthInfo, type SourceType } from "../../../shared/schema";
import { Button, Kbd, cx } from "../../components/ui";

const ICONS: Record<SourceType, typeof Mail> = {
  email: Mail,
  meeting: Users,
  notes: NotebookPen,
  other: FileText,
};

const SHORT_LABELS: Record<SourceType, string> = {
  email: "Email",
  meeting: "Réunion",
  notes: "Notes",
  other: "Autre",
};

interface Props {
  text: string;
  sourceType: SourceType;
  context: string;
  maxChars: number;
  loading: boolean;
  health: HealthInfo | null;
  onText: (v: string) => void;
  onSourceType: (v: SourceType) => void;
  onContext: (v: string) => void;
  onSubmit: () => void;
  onSample: () => void;
  onClear: () => void;
}

export const SourcePanel = forwardRef<HTMLTextAreaElement, Props>(function SourcePanel(
  { text, sourceType, context, maxChars, loading, health, onText, onSourceType, onContext, onSubmit, onSample, onClear },
  textareaRef,
) {
  const ids = useId();
  const count = text.trim().length;
  const tooLong = count > maxChars;
  const canSubmit = count >= 20 && !tooLong && !loading;
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <section aria-labelledby={`${ids}-h`} className="flex min-h-0 flex-col">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 id={`${ids}-h`} className="font-display text-xl font-semibold tracking-tight">
            Texte source
          </h1>
          <p className="text-sm text-muted">Collez un email, un compte rendu ou vos notes.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSample}
          disabled={loading}
          icon={<Sparkles className="size-3.5" aria-hidden />}
        >
          Exemple
        </Button>
      </div>

      <form
        className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-card shadow-card transition-colors focus-within:border-line-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <fieldset className="border-b border-line p-2">
          <legend className="sr-only">Type de source</legend>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-paper p-1">
            {SOURCE_TYPES.map((type) => {
              const Icon = ICONS[type];
              const active = sourceType === type;
              return (
                <label
                  key={type}
                  title={SOURCE_TYPE_LABELS[type]}
                  className={cx(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-all duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink",
                    active ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink",
                  )}
                >
                  <input
                    type="radio"
                    name={`${ids}-type`}
                    value={type}
                    checked={active}
                    onChange={() => onSourceType(type)}
                    className="sr-only"
                  />
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{SHORT_LABELS[type]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label htmlFor={`${ids}-text`} className="sr-only">
          Texte à analyser
        </label>
        <textarea
          id={`${ids}-text`}
          ref={textareaRef}
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }
          }}
          placeholder={"Bonjour à tous,\n\nSuite à la réunion, Marie doit envoyer le devis avant vendredi…"}
          spellCheck={false}
          className="min-h-[260px] w-full flex-1 resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-ink placeholder:text-faint focus:outline-none lg:min-h-0"
          aria-describedby={`${ids}-count`}
        />

        <div className="flex items-center justify-between gap-3 px-4 pb-2 text-[12px]">
          <span id={`${ids}-count`} className={cx("font-mono tabular-nums", tooLong ? "font-semibold text-rose-ink" : "text-faint")}>
            {count.toLocaleString("fr-FR")} / {maxChars.toLocaleString("fr-FR")} caractères
            {tooLong && " — texte trop long"}
          </span>
          {text && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted transition-colors hover:bg-rose-soft hover:text-rose-ink"
            >
              <Eraser className="size-3" aria-hidden />
              Tout effacer
            </button>
          )}
        </div>

        <div className="border-t border-line p-3">
          <label htmlFor={`${ids}-ctx`} className="mb-1.5 block text-[12px] font-medium text-muted">
            Contexte <span className="font-normal text-faint">(facultatif)</span>
          </label>
          <input
            id={`${ids}-ctx`}
            value={context}
            maxLength={MAX_CONTEXT_CHARS}
            onChange={(e) => onContext(e.target.value)}
            placeholder="Ex. : projet de refonte du site, je suis la cheffe de projet"
            className="w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm placeholder:text-faint transition-colors focus:border-ink focus:bg-card focus:outline-none"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-1.5 text-[12px] leading-snug text-muted">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-moss" aria-hidden />
            {health?.mode === "ai" ? (
              <span>
                Texte transmis à {health.provider} pour l'analyse, jamais stocké par Text2Action.
              </span>
            ) : health?.mode === "demo" ? (
              <span>Mode démo : analyse par règles sur notre serveur, sans fournisseur IA.</span>
            ) : (
              <span>Texte non stocké, ni sur nos serveurs ni dans votre navigateur.</span>
            )}
          </p>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!canSubmit}
            icon={<Wand2 className="size-4" aria-hidden />}
            className="w-full sm:w-auto"
          >
            {loading ? "Analyse en cours…" : "Extraire les actions"}
            {!loading && (
              <span className="ml-1 hidden items-center gap-0.5 opacity-70 sm:inline-flex">
                <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                <Kbd>↵</Kbd>
              </span>
            )}
          </Button>
        </div>
      </form>
    </section>
  );
});
