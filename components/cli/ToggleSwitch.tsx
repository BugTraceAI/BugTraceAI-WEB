import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** Shared binary switch primitive used by configuration and design-system previews. */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  className = '',
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`toggle-premium ${checked ? 'is-on' : 'is-off'} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
  >
    <span aria-hidden="true" className="toggle-premium-thumb" />
  </button>
);
