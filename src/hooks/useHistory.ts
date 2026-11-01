import { useReducer, useRef } from 'react';
import { createHistory, type HistoryController } from './history';

export interface UseHistoryResult<T> {
  value: T;
  push(next: T): void;
  undo(): void;
  redo(): void;
  reset(next: T): void;
  patchSilent(next: T): void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * React binding around the pure history controller. All mutation happens
 * outside setState updaters (safe under StrictMode double-invocation).
 */
export function useHistory<T>(initial: T, limit = 50): UseHistoryResult<T> {
  const ref = useRef<HistoryController<T> | null>(null);
  if (ref.current === null) {
    ref.current = createHistory(initial, limit);
  }
  const h = ref.current;
  const [, bump] = useReducer((x: number) => x + 1, 0);

  return {
    value: h.get(),
    push: (next) => {
      h.push(next);
      bump();
    },
    undo: () => {
      h.undo();
      bump();
    },
    redo: () => {
      h.redo();
      bump();
    },
    reset: (next) => {
      h.reset(next);
      bump();
    },
    patchSilent: (next) => {
      h.patchSilent(next);
      bump();
    },
    canUndo: h.canUndo(),
    canRedo: h.canRedo(),
  };
}
