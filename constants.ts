// @author: Albert C | @yz9yt | github.com/yz9yt
// version 0.1 Beta
import { Severity } from './types.ts';

export const APP_VERSION = '0.2.0 Beta';

// This now serves as a fallback list in case the API fetch fails.
export const OPEN_ROUTER_MODELS = [
    'google/gemini-3-flash-preview',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'mistralai/mistral-large',
    'openai/gpt-3.5-turbo',
];


export const SEVERITY_STYLES: Record<Severity, { headerBg: string; border: string; text: string; shadow: string }> = {
  [Severity.CRITICAL]: {
    headerBg: 'bg-gradient-to-r from-red-900/60 to-pink-900/60',
    border: 'border-red-500/50',
    text: 'text-red-200',
    shadow: 'shadow-red-500/20'
  },
  [Severity.HIGH]: {
    headerBg: 'bg-gradient-to-r from-orange-900/60 to-red-900/60',
    border: 'border-orange-500/50',
    text: 'text-orange-200',
    shadow: 'shadow-orange-500/20'
  },
  [Severity.MEDIUM]: {
    headerBg: 'bg-gradient-to-r from-yellow-900/60 to-orange-900/60',
    border: 'border-yellow-500/50',
    text: 'text-yellow-200',
    shadow: 'shadow-yellow-500/20'
  },
  [Severity.LOW]: {
    headerBg: 'bg-gradient-to-r from-cyan-900/60 to-blue-900/60',
    border: 'border-cyan-500/50',
    text: 'text-cyan-200',
    shadow: 'shadow-cyan-500/20'
  },
  [Severity.INFO]: {
    headerBg: 'bg-gradient-to-r from-green-900/60 to-teal-900/60',
    border: 'border-green-500/50',
    text: 'text-green-200',
    shadow: 'shadow-green-500/20'
  },
  [Severity.UNKNOWN]: {
    headerBg: 'bg-gradient-to-r from-gray-900/60 to-slate-900/60',
    border: 'border-gray-500/50',
    text: 'text-gray-300',
    shadow: 'shadow-gray-500/20'
  },
};