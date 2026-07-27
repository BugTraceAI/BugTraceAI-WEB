// components/BrandedLoader.tsx
import React from 'react';
import { BugTraceAILogo } from './Icons.tsx';

interface BrandedLoaderProps {
  /** Tailwind size classes for the logo, e.g. "h-8 w-8". Default "h-9 w-9". */
  size?: string;
  /** Optional label shown under the beating logo. */
  label?: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Branded loading indicator: the BugTraceAI logo "beating" (heartbeat) instead of a
 * generic rotating spinner. Uses the `heartbeat` keyframe from tailwind.config.js
 * (double-beat scale) plus a soft coral glow. On fast machines it's imperceptible;
 * on slow ones it reads as an on-brand pulse rather than a harsh spin.
 */
export const BrandedLoader: React.FC<BrandedLoaderProps> = ({ size = 'h-9 w-9', label, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
    <BugTraceAILogo
      className={`${size} text-coral animate-heartbeat`}
    />
    {label && (
      <p className="text-xs font-bold uppercase tracking-widest text-muted animate-pulse">{label}</p>
    )}
  </div>
);

export default BrandedLoader;
