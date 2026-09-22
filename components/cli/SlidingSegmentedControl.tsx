import React from 'react';

export interface SlidingSegmentedOption {
  value: string;
  label: React.ReactNode;
}

interface SlidingSegmentedControlProps {
  value: string;
  options: SlidingSegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  testIdPrefix?: string;
  itemWidth?: number;
  /** Main controls orient the page; sub controls stay quieter inside a card. */
  variant?: 'main' | 'sub';
}

/**
 * Shared compact selector used for mutually-exclusive modes.
 * The active coral surface slides between fixed-width options so every
 * instance keeps the same rhythm as the Model Lab control.
 */
export const SlidingSegmentedControl: React.FC<SlidingSegmentedControlProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  testIdPrefix,
  itemWidth = 104,
  variant = 'main',
}) => {
  const activeIndex = Math.max(0, options.findIndex(option => option.value === value));
  const isSub = variant === 'sub';
  const gapPx = isSub ? 2 : 4;
  const step = itemWidth + gapPx;

  return (
    <div
      className={`relative inline-flex items-center ${isSub ? 'gap-0.5 rounded-lg p-0.5' : 'gap-1 rounded-xl p-1'} border border-white/10 bg-white/[0.03] ${disabled ? 'opacity-60' : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${isSub ? 'segmented-sub-indicator bottom-0.5 left-0.5 top-0.5 rounded-md' : 'bottom-1 left-1 top-1 rounded-lg bg-coral shadow-[0_4px_12px_rgba(255,127,80,0.3)]'} transition-transform duration-300 ease-out`}
        style={{ width: itemWidth, transform: `translateX(${activeIndex * step}px)` }}
      />
      {options.map(option => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={disabled || undefined}
            data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            style={{ width: itemWidth }}
            className={`relative z-10 btn-mini ${isSub ? '!h-7 !min-h-0 !px-2 !py-1 !text-[8px] !tracking-[0.08em]' : '!h-8 !px-3 !py-1.5'} gap-1.5 whitespace-nowrap ${selected ? 'text-white' : 'border-transparent bg-transparent text-muted hover:text-white'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
