import type { ReactNode } from 'react';
import { cx } from '../../utils/misc';

export function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="empty">
      {icon}
      <p>{text}</p>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange(v: boolean): void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  return (
    <div className="field">
      <span className="label">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange(v: T): void;
  ariaLabel?: string;
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={cx(value === o.id && 'active')}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
