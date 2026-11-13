import { useId, useState } from "react";
import {
  AlertOctagon,
  ClipboardCopy,
  FileDown,
  FileSpreadsheet,
  Info,
  ListChecks,
  RotateCcw,
  SearchX,
} from "lucide-react";
import type { ExtractionResult, Task } from "../../../shared/schema";
import { toCsv, toMarkdown, toPlainText } from "../../../shared/export";
import { Button, cx } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { copyText, datedFilename, downloadFile } from "../../lib/download";
import { TaskCard } from "./TaskCard";
import { applyFilter, type Filter } from "./useTaskList";

export type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; meta: Pick<ExtractionResult, "mode" | "noTaskReason" | "warnings"> };

interface Props {
  state: ResultState;
  tasks: Task[];
  counts: Record<Filter, number>;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
  onRestart: () => void;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "todo", label: "À faire" },
  { key: "done", label: "Terminées" },
];

export function ResultPanel({ state, tasks, counts, onToggle, onUpdate, onDelete, onRetry, onRestart }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const toast = useToast();
  const ids = useId();
  const visible = applyFilter(tasks, filter);
  const hasTasks = state.status === "done" && tasks.length > 0;

  const exportScope =
    visible.length === tasks.length
      ? "toutes les tâches"
      : visible.length === 1
        ? "la tâche affichée"
        : `les ${visible.length} tâches affichées`;

  const handleCopy = async () => {
    try {
      await copyText(toPlainText(visible));
      toast(`Liste copiée (${visible.length} tâche${visible.length > 1 ? "s" : ""})`);
    } catch {
      toast("Copie impossible : autorisez l'accès au presse-papiers.", "error");
    }
  };

  return (
    <section aria-labelledby={`${ids}-h`} className="flex min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${ids}-h`} className="font-display text-xl font-semibold tracking-tight">
            Actions
          </h2>
          <p className="text-sm text-muted">
            {hasTasks
              ? `${counts.all} action${counts.all > 1 ? "s" : ""} détectée${counts.all > 1 ? "s" : ""} — à relire avant usage.`
              : "Chaque action cite le passage d'où elle vient."}
          </p>
        </div>
        {(state.status === "done" || state.status === "error") && (
          <Button variant="ghost" size="sm" onClick={onRestart} icon={<RotateCcw className="size-3.5" aria-hidden />}>
            Nouveau texte
          </Button>
        )}
      </div>

      {hasTasks && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Filtrer les tâches" className="inline-flex rounded-xl bg-paper-2 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                type="button"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
                  filter === f.key ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink",
                )}
              >
                {f.label}
                <span className="font-mono text-[11px] tabular-nums opacity-60">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Exporter">
            <Button size="sm" onClick={handleCopy} disabled={!visible.length} title={`Copier ${exportScope}`} icon={<ClipboardCopy className="size-3.5" aria-hidden />}>
              Copier
            </Button>
            <Button
              size="sm"
              disabled={!visible.length}
              title={`Exporter ${exportScope} en Markdown`}
              onClick={() => {
                downloadFile(datedFilename("md"), toMarkdown(visible), "text/markdown");
                toast("Fichier Markdown téléchargé");
              }}
              icon={<FileDown className="size-3.5" aria-hidden />}
            >
              Markdown
            </Button>
            <Button
              size="sm"
              disabled={!visible.length}
              title={`Exporter ${exportScope} en CSV`}
              onClick={() => {
                downloadFile(datedFilename("csv"), toCsv(visible), "text/csv");
                toast("Fichier CSV téléchargé");
              }}
              icon={<FileSpreadsheet className="size-3.5" aria-hidden />}
            >
              CSV
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1" aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "idle" && <IdleState />}
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && <ErrorState message={state.message} onRetry={onRetry} />}
        {state.status === "done" && tasks.length === 0 && (
          <EmptyState
            reason={state.meta.noTaskReason}
            hadTasks={state.meta.noTaskReason === null}
            onRestart={onRestart}
          />
        )}
        {hasTasks && (
          <>
            {state.meta.warnings.length > 0 && (
              <p className="mb-3 flex items-start gap-2 rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {state.meta.warnings.join(" ")}
              </p>
            )}
            {visible.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-2 px-4 py-10 text-center text-sm text-muted">
                {filter === "done" ? "Aucune tâche terminée pour l'instant." : "Tout est fait. Bien joué."}
              </p>
            ) : (
              <ul className="grid gap-2.5">
                {visible.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            )}
            <p className="mt-4 text-center text-[12px] text-faint">
              Résultat généré automatiquement : vérifiez les responsables et les échéances avant de le partager.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "grain flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-line-2 px-6 py-12 text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

function IdleState() {
  return (
    <Shell>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-card shadow-card">
        <ListChecks className="size-5 text-ink-2" aria-hidden />
      </div>
      <p className="font-display text-lg font-semibold">Vos actions apparaîtront ici</p>
      <ul className="mt-3 grid gap-1.5 text-left text-sm text-muted">
        <li>• Responsable affiché seulement s'il est nommé</li>
        <li>• Échéance recopiée du texte, jamais devinée</li>
        <li>• Extrait source pour chaque action</li>
      </ul>
    </Shell>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-2.5" role="status">
      <span className="sr-only">Analyse du texte en cours…</span>
      <p className="mb-1 flex items-center gap-2 text-sm text-muted">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-moss/50" />
          <span className="relative inline-flex size-2 rounded-full bg-moss" />
        </span>
        Lecture du texte et repérage des demandes…
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-line bg-card p-5" style={{ opacity: 1 - i * 0.25 }}>
          <div className="flex gap-3.5">
            <div className="skeleton size-[22px] rounded-md" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-4 w-3/5 rounded" />
              <div className="flex gap-1.5">
                <div className="skeleton h-5 w-20 rounded-md" />
                <div className="skeleton h-5 w-24 rounded-md" />
                <div className="skeleton h-5 w-16 rounded-md" />
              </div>
              <div className="skeleton h-3 w-4/5 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Shell className="border-rose-ink/25 bg-rose-soft/40">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-card shadow-card">
        <AlertOctagon className="size-5 text-rose-ink" aria-hidden />
      </div>
      <p className="font-display text-lg font-semibold">L'extraction n'a pas abouti</p>
      <p role="alert" className="mt-1.5 max-w-sm text-sm text-ink-2">
        {message}
      </p>
      <Button className="mt-5" onClick={onRetry} icon={<RotateCcw className="size-3.5" aria-hidden />}>
        Réessayer
      </Button>
    </Shell>
  );
}

function EmptyState({ reason, hadTasks, onRestart }: { reason: string | null; hadTasks: boolean; onRestart: () => void }) {
  return (
    <Shell>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-card shadow-card">
        <SearchX className="size-5 text-ink-2" aria-hidden />
      </div>
      <p className="font-display text-lg font-semibold">
        {hadTasks ? "Toutes les tâches ont été supprimées" : "Aucune action détectée"}
      </p>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        {hadTasks
          ? "Collez un nouveau texte pour recommencer."
          : (reason ?? "Ce texte ne contient pas de demande ou d'engagement explicite.")}
      </p>
      {!hadTasks && (
        <p className="mt-3 max-w-sm text-[13px] text-faint">
          Plutôt que d'inventer une liste, Text2Action préfère n'en proposer aucune.
        </p>
      )}
      <Button className="mt-5" onClick={onRestart} icon={<RotateCcw className="size-3.5" aria-hidden />}>
        Nouveau texte
      </Button>
    </Shell>
  );
}
