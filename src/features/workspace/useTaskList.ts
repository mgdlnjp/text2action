import { useCallback, useMemo, useReducer } from "react";
import type { Task } from "../../../shared/schema";

export type Filter = "all" | "todo" | "done";

type Action =
  | { type: "set"; tasks: Task[] }
  | { type: "toggle"; id: string }
  | { type: "update"; id: string; patch: Partial<Task> }
  | { type: "delete"; id: string }
  | { type: "clear" };

function reducer(state: Task[], action: Action): Task[] {
  switch (action.type) {
    case "set":
      return action.tasks;
    case "toggle":
      return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    case "update":
      return state.map((t) => (t.id === action.id ? { ...t, ...action.patch, id: t.id } : t));
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "clear":
      return [];
  }
}

/** État local des tâches : rien n'est persisté (ni serveur, ni localStorage). */
export function useTaskList() {
  const [tasks, dispatch] = useReducer(reducer, []);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      todo: tasks.filter((t) => !t.done).length,
      done: tasks.filter((t) => t.done).length,
    }),
    [tasks],
  );

  return {
    tasks,
    counts,
    set: useCallback((next: Task[]) => dispatch({ type: "set", tasks: next }), []),
    toggle: useCallback((id: string) => dispatch({ type: "toggle", id }), []),
    update: useCallback((id: string, patch: Partial<Task>) => dispatch({ type: "update", id, patch }), []),
    remove: useCallback((id: string) => dispatch({ type: "delete", id }), []),
    clear: useCallback(() => dispatch({ type: "clear" }), []),
  };
}

export function applyFilter(tasks: Task[], filter: Filter): Task[] {
  if (filter === "todo") return tasks.filter((t) => !t.done);
  if (filter === "done") return tasks.filter((t) => t.done);
  return tasks;
}
