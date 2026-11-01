import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { uid } from '../../utils/misc';

export type ToastType = 'info' | 'success' | 'error';

interface Toast {
  id: string;
  msg: string;
  type: ToastType;
}

interface ToastApi {
  toast(msg: string, type?: ToastType): void;
}

const ToastContext = createContext<ToastApi>({ toast: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  const toast = useCallback((msg: string, type: ToastType = 'info') => {
    const id = uid();
    setToasts((list) => [...list.slice(-2), { id, msg, type }]);
    const t = window.setTimeout(() => {
      setToasts((list) => list.filter((x) => x.id !== id));
    }, 2600);
    timers.current.push(t);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
