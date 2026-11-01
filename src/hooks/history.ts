// ---------------------------------------------------------------------------
// Framework-free undo/redo history controller (bounded, deep-cloned).
// The React wrapper lives in useHistory.ts. Kept pure so it is directly
// unit-testable and never touches React state updaters.
// ---------------------------------------------------------------------------

import { cloneDeep } from '../utils/misc';

export interface HistoryController<T> {
  get(): T;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Records the current state onto the undo stack and adopts `next`. */
  push(next: T): void;
  /** Returns the restored state, or undefined when nothing to undo. */
  undo(): T | undefined;
  /** Returns the restored state, or undefined when nothing to redo. */
  redo(): T | undefined;
  /** Replaces state and clears both stacks (e.g. loading a draft). */
  reset(next: T): void;
  /** Replaces state WITHOUT recording history (e.g. metadata id assignment). */
  patchSilent(next: T): void;
  undoCount(): number;
  redoCount(): number;
}

export function createHistory<T>(initial: T, limit = 50): HistoryController<T> {
  let current = cloneDeep(initial);
  let past: T[] = [];
  let future: T[] = [];

  return {
    get: () => current,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    push(next) {
      past = [...past.slice(-(limit - 1)), current];
      current = cloneDeep(next);
      future = [];
    },
    undo() {
      const prev = past.pop();
      if (prev === undefined) return undefined;
      future = [current, ...future];
      current = prev;
      return current;
    },
    redo() {
      const next = future.shift();
      if (next === undefined) return undefined;
      past = [...past, current];
      current = next;
      return current;
    },
    reset(next) {
      current = cloneDeep(next);
      past = [];
      future = [];
    },
    patchSilent(next) {
      current = cloneDeep(next);
    },
    undoCount: () => past.length,
    redoCount: () => future.length,
  };
}
