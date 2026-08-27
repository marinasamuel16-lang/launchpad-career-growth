import { useEffect, useState } from "react";

const LOCAL_KEY = "lp_actions_done";

function read(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
}

const listeners = new Set<(ids: string[]) => void>();

export function useActionsDone() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const fn = (next: string[]) => setIds(next);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const isDone = (actionId: string) => ids.includes(actionId);

  const setDone = (actionId: string, done: boolean) => {
    const current = read();
    const next = done
      ? Array.from(new Set([...current, actionId]))
      : current.filter((x) => x !== actionId);
    write(next);
    listeners.forEach((fn) => fn(next));
  };

  return { doneIds: ids, isDone, setDone };
}
