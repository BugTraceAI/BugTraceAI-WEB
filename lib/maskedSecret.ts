/**
 * Render a secret safely for a confirmation hint.
 *
 * The value stays in the password input; this preview only exposes a short
 * prefix and the final five characters so users can verify which key they are
 * editing without putting the complete secret on screen.
 */
export function formatSecretPreview(value: string, visibleSuffixLength = 5): string {
  const normalized = value.trim();
  if (!normalized) return '';
  if (normalized.length <= visibleSuffixLength) return '•'.repeat(normalized.length);

  const prefixLength = Math.min(9, Math.max(4, normalized.length - visibleSuffixLength));
  const prefix = normalized.slice(0, prefixLength);
  const suffix = normalized.slice(-visibleSuffixLength);
  const maskedLength = Math.max(4, normalized.length - prefixLength - visibleSuffixLength);
  return `${prefix}${'•'.repeat(maskedLength)}${suffix}`;
}

