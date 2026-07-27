/**
 * webFetchService.ts
 *
 * Fetches a URL and returns cleaned, readable text content
 * for injection into the AI chat context.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

const MAX_CONTENT_LENGTH = 50_000; // chars – enough for a long page without overwhelming the LLM
const TIMEOUT_MS = 15_000;

/**
 * Strip HTML tags and collapse whitespace.
 */
function stripHtml(html: string): string {
  return html
    // Remove <script> and <style> blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove all other tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fetch the content of a URL and return cleaned text.
 * Throws if the URL is invalid, unreachable, or returns non-2xx.
 */
export async function fetchWebPage(rawUrl: string): Promise<string> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported');
  }

  return new Promise((resolve, reject) => {
    const client = parsed.protocol === 'https:' ? https : http;

    const options: https.RequestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BugTraceAI-WebBrowsing/1.0)',
        Accept: 'text/html,application/xhtml+xml,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        Connection: 'close',
      },
      // Allow self-signed certs inside Docker environments
      rejectUnauthorized: false,
    };

    const req = client.get(
      rawUrl,
      options,
      (res) => {
        // Follow one redirect
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          req.destroy();
          // Validate redirect target — block internal/metadata URLs (SSRF prevention)
          try {
            const redirectUrl = new URL(res.headers.location, rawUrl);
            const host = redirectUrl.hostname;
            if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('169.254.') || host.startsWith('10.') || host.startsWith('192.168.') || host.endsWith('.internal')) {
              reject(new Error(`Redirect to internal host blocked: ${host}`));
              return;
            }
            fetchWebPage(redirectUrl.href).then(resolve).catch(reject);
          } catch {
            reject(new Error('Invalid redirect URL'));
          }
          return;
        }

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          req.destroy();
          reject(new Error(`HTTP ${res.statusCode} from ${rawUrl}`));
          return;
        }

        const contentType = res.headers['content-type'] || '';
        let body = '';

        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > MAX_CONTENT_LENGTH * 2) {
            // Prevent runaway downloads
            req.destroy();
          }
        });

        res.on('end', () => {
          const isHtml = contentType.includes('text/html') || contentType.includes('xhtml');
          const cleaned = isHtml ? stripHtml(body) : body;
          resolve(cleaned.slice(0, MAX_CONTENT_LENGTH));
        });

        res.on('error', reject);
      }
    );

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`Request timed out after ${TIMEOUT_MS / 1000}s`));
    });

    req.on('error', reject);
  });
}
