import { useCliHealth } from './useCliHealth';

/**
 * Hook to fetch the connected CLI version via the health endpoint.
 * Returns the version string if CLI is reachable, null otherwise.
 *
 * @deprecated Use useCliHealth() for richer status information.
 */
export function useCliVersion(): string | null {
  const health = useCliHealth();
  return health.version;
}
