/**
 * Version check utility for BugTraceAI WEB backend.
 *
 * Checks GitHub Releases API for newer versions with in-memory cache (24h TTL).
 * All errors are silenced — never blocks or breaks the server.
 */

const GITHUB_API_URL = 'https://api.github.com/repos/BugTraceAI/{repo}/releases/latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REQUEST_TIMEOUT_MS = 5000;

interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion: string;
  releaseUrl: string;
}

interface CacheEntry {
  checkedAt: number;
  data: UpdateInfo;
}

const cache: Map<string, CacheEntry> = new Map();

/**
 * Compare two semver strings. Returns true if latest > current.
 */
export function compareVersions(current: string, latest: string): boolean {
  try {
    // Strip leading 'v' and pre-release suffixes (-beta, -alpha, -rc.N)
    const cleanCurrent = current.replace(/^v/, '').split('-')[0];
    const cleanLatest = latest.replace(/^v/, '').split('-')[0];
    const c = cleanCurrent.split('.').map(Number);
    const l = cleanLatest.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((l[i] || 0) > (c[i] || 0)) return true;
      if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check for updates against GitHub Releases API.
 * Uses in-memory cache with 24h TTL.
 */
export async function checkForUpdate(
  currentVersion: string,
  repo: string = 'BugTraceAI-WEB'
): Promise<UpdateInfo | null> {
  try {
    // Check cache
    const cached = cache.get(repo);
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
      return {
        ...cached.data,
        updateAvailable: compareVersions(currentVersion, cached.data.latestVersion),
      };
    }

    // Fetch from GitHub
    const url = GITHUB_API_URL.replace('{repo}', repo);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: { 'User-Agent': `BugTraceAI-WEB/${currentVersion}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json() as { tag_name?: string; html_url?: string };
    const tag = (data.tag_name || '').replace(/^v/, '');
    const releaseUrl = data.html_url || '';

    if (!tag) return null;

    const info: UpdateInfo = {
      updateAvailable: compareVersions(currentVersion, tag),
      latestVersion: tag,
      releaseUrl,
    };

    // Store in cache
    cache.set(repo, { checkedAt: Date.now(), data: info });

    return info;
  } catch {
    // Silent fail — return cached data if available
    const cached = cache.get(repo);
    return cached?.data ?? null;
  }
}
