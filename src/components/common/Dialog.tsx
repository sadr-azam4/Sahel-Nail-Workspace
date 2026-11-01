import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Centered card instead of bottom sheet. */
  center?: boolean;
}

export function Dialog({ open, onClose, title, children, footer, center }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={'dialog' + (center ? ' center' : '')}
      >
        <div className="dialog-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onConfirm(): void;
  onClose(): void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأیید',
  danger = false,
  busy = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      center
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            انصراف
          </button>
          <button
            type="button"
            className={'btn ' + (danger ? 'btn-danger' : 'btn-primary')}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? 'لطفاً صبر کنید…' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ whiteSpace: 'pre-line' }}>{message}</p>
      {children}
    </Dialog>
  );
}
