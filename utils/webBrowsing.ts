// utils/webBrowsing.ts
// Utility to detect URLs in a message and fetch their content
// via the backend /api/tools/fetch endpoint.

const URL_REGEX = /https?:\/\/[^\s"'<>]+/g;

export function extractUrls(text: string): string[] {
  return [...new Set(text.match(URL_REGEX) || [])];
}

/**
 * For each URL found in the message, fetches the page content
 * and returns an enriched message with the page content appended.
 */
export async function enrichMessageWithWebContent(
  message: string,
  apiBase: string
): Promise<string> {
  const urls = extractUrls(message);
  if (urls.length === 0) return message;

  const fetched: Array<{ url: string; content: string }> = [];

  for (const url of urls.slice(0, 3)) {
    // Max 3 URLs per message
    try {
      const res = await fetch(`${apiBase}/api/tools/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.data?.content) {
        fetched.push({ url, content: data.data.content });
      }
    } catch {
      // Silently skip URLs that fail – agent still answers with the original message
    }
  }

  if (fetched.length === 0) return message;

  const appendix = fetched
    .map(
      ({ url, content }) =>
        `\n\n---\n[Web Browse Result: ${url}]\n\n${content.slice(0, 15_000)}\n---`
    )
    .join('');

  return message + appendix;
}
