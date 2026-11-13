import { useId, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCheck,
  Flag,
  Pencil,
  Quote,
  Repeat2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { PRIORITIES, type Priority, type Task } from "../../../shared/schema";
import { dueLabel, PRIORITY_LABELS } from "../../../shared/export";
import { Badge, Button, cx } from "../../components/ui";

interface Props {
  task: Task;
  index: number;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const CONFIDENCE_TEXT = { high: "élevée", medium: "moyenne", low: "faible" } as const;

export function TaskCard({ task, index, onToggle, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const checkId = useId();

  if (editing) {
    return (
      <TaskEditor
        task={task}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          onUpdate(task.id, patch);
          setEditing(false);
        }}
      />
    );
  }

  const due = dueLabel(task);

  return (
    <li
      className={cx(
        "group animate-rise relative rounded-2xl border bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-200 hover:shadow-lift sm:p-5",
        task.done ? "border-line/70" : "border-line",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex gap-3.5">
        <div className="pt-0.5">
          <input
            id={checkId}
            type="checkbox"
            checked={task.done}
            onChange={() => onToggle(task.id)}
            className="peer sr-only"
          />
          <label
            htmlFor={checkId}
            className={cx(
              "flex size-[22px] cursor-pointer items-center justify-center rounded-md border-[1.5px] transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2",
              task.done ? "border-ink bg-ink text-marker" : "border-line-2 bg-card hover:border-ink",
            )}
          >
            <Check
              className={cx("size-3.5 transition-transform", task.done ? "scale-100" : "scale-0")}
              strokeWidth={3}
              aria-hidden
            />
            <span className="sr-only">
              {task.done ? "Marquer comme à faire" : "Marquer comme terminée"} : {task.title}
            </span>
          </label>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={cx(
                "text-[15px] leading-6 font-semibold tracking-[-0.01em] text-pretty transition-colors",
                task.done && "text-faint line-through decoration-faint/60",
              )}
            >
              {task.title}
            </h3>
            <div className="-mt-1 -mr-1.5 flex shrink-0 gap-0.5 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                className="w-8 px-0"
                onClick={() => setEditing(true)}
                aria-label={`Modifier « ${task.title} »`}
                icon={<Pencil className="size-3.5" aria-hidden />}
              />
              <Button
                variant="danger"
                size="sm"
                className="w-8 px-0"
                onClick={() => onDelete(task.id)}
                aria-label={`Supprimer « ${task.title} »`}
                icon={<Trash2 className="size-3.5" aria-hidden />}
              />
            </div>
          </div>

          {task.description && (
            <p className={cx("mt-1 text-sm leading-relaxed text-muted", task.done && "text-faint")}>
              {task.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {task.owner ? (
              <Badge icon={<UserRound className="size-3" aria-hidden />} title="Responsable cité dans le texte">
                {task.owner}
              </Badge>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-line-2 px-1.5 text-[12px] leading-5 text-faint">
                <UserRound className="size-3" aria-hidden />
                Responsable non précisé
              </span>
            )}
            {due &&
              (task.dueIsCertain ? (
                <Badge icon={<CalendarDays className="size-3" aria-hidden />} title={`Texte : « ${task.dueText} »`}>
                  {due}
                </Badge>
              ) : (
                <Badge
                  tone="amber"
                  icon={<CalendarDays className="size-3" aria-hidden />}
                  title="Échéance mentionnée mais imprécise : ce n'est pas une date confirmée"
                >
                  {due}
                </Badge>
              ))}
            <Badge
              tone={task.priority === "high" ? "ink" : "neutral"}
              icon={<Flag className="size-3" aria-hidden />}
              title={task.priorityIsExplicit ? "Priorité indiquée dans le texte" : "Priorité estimée par l'outil"}
            >
              {PRIORITY_LABELS[task.priority]}
              {!task.priorityIsExplicit && <span className="font-normal opacity-70"> · estimée</span>}
            </Badge>
            {task.doneInSource && (
              <Badge tone="moss" icon={<CheckCheck className="size-3" aria-hidden />} title="Le texte indique que c'est déjà fait">
                Déjà faite selon le texte
              </Badge>
            )}
            {task.mentions > 1 && (
              <Badge icon={<Repeat2 className="size-3" aria-hidden />} title="Action répétée dans le texte, fusionnée">
                Mentionnée {task.mentions}×
              </Badge>
            )}
            {!task.needsConfirmation && (
              <Badge tone="moss" title="Niveau de confiance de l'extraction">
                Confiance {CONFIDENCE_TEXT[task.confidence]}
              </Badge>
            )}
          </div>

          {task.needsConfirmation && (
            <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-amber-soft/80 px-3 py-2 text-[13px] text-amber-ink">
              <div className="flex min-w-0 gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <p className="min-w-0">
                  <span className="font-semibold">À confirmer</span>
                  {task.confirmationReasons.length > 0 && (
                    <span className="text-amber-ink/85"> — {task.confirmationReasons.join(" · ")}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdate(task.id, { needsConfirmation: false, confirmationReasons: [] })}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-semibold underline-offset-2 hover:bg-amber-ink/10 hover:underline"
              >
                J'ai vérifié
              </button>
            </div>
          )}

          <figure className="mt-3 flex gap-2 border-l-2 border-marker pl-3">
            <Quote className="mt-0.5 size-3 shrink-0 text-faint" aria-hidden />
            <blockquote
              className="line-clamp-3 font-mono text-[12px] leading-[1.6] break-words text-muted"
              title={task.sourceExcerpt}
            >
              {task.sourceExcerpt}
            </blockquote>
            <figcaption className="sr-only">Extrait du texte source</figcaption>
          </figure>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

function TaskEditor({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (patch: Partial<Task>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [owner, setOwner] = useState(task.owner ?? "");
  const [dueText, setDueText] = useState(task.dueText ?? "");
  const [dueIsCertain, setDueIsCertain] = useState(task.dueIsCertain);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const ids = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const nextDue = dueText.trim() || null;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      owner: owner.trim() || null,
      dueText: nextDue,
      dueDate: nextDue === task.dueText ? task.dueDate : null,
      dueIsCertain: !!nextDue && dueIsCertain,
      priority,
      priorityIsExplicit: priority !== task.priority ? true : task.priorityIsExplicit,
    });
  };

  const field =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-faint transition-colors focus:border-ink focus:outline-none";
  const label = "mb-1 block text-[12px] font-medium text-muted";

  return (
    <li className="animate-rise rounded-2xl border border-ink bg-card p-4 shadow-lift sm:p-5">
      <form
        onSubmit={submit}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        className="grid gap-3"
        aria-label={`Modifier la tâche ${task.title}`}
      >
        <div>
          <label htmlFor={`${ids}-title`} className={label}>
            Titre
          </label>
          <input
            id={`${ids}-title`}
            autoFocus
            required
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cx(field, "font-semibold")}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-desc`} className={label}>
            Description
          </label>
          <textarea
            id={`${ids}-desc`}
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cx(field, "resize-y")}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`${ids}-owner`} className={label}>
              Responsable
            </label>
            <input
              id={`${ids}-owner`}
              maxLength={80}
              value={owner}
              placeholder="Non précisé"
              onChange={(e) => setOwner(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label htmlFor={`${ids}-due`} className={label}>
              Échéance
            </label>
            <input
              id={`${ids}-due`}
              maxLength={80}
              value={dueText}
              placeholder="Aucune"
              onChange={(e) => setDueText(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label htmlFor={`${ids}-prio`} className={label}>
              Priorité
            </label>
            <select
              id={`${ids}-prio`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={field}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={dueIsCertain && !!dueText.trim()}
            disabled={!dueText.trim()}
            onChange={(e) => setDueIsCertain(e.target.checked)}
            className="size-4 accent-ink"
          />
          Échéance confirmée
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={onCancel} icon={<X className="size-3.5" aria-hidden />}>
            Annuler
          </Button>
          <Button size="sm" variant="primary" type="submit" icon={<Check className="size-3.5" aria-hidden />}>
            Enregistrer
          </Button>
        </div>
      </form>
    </li>
  );
}
