import { URL } from 'node:url';

export function normalizeUrl(
  value: string,
  options: {
    preserveQueryString: boolean;
  },
): string {
  const url = new URL(value);
  url.hash = '';
  if (!options.preserveQueryString) url.search = '';
  url.hostname = url.hostname.replace(/\.$/, '').toLowerCase();
  return url.href;
}

export function isAllowedOrigin(value: string, origin: URL): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === origin.protocol &&
      url.hostname === origin.hostname &&
      url.port === origin.port
    );
  } catch {
    return false;
  }
}

export function assertAllowedFinalUrl(requestedUrl: string, finalUrl: string, origin: URL): void {
  if (!isAllowedOrigin(finalUrl, origin)) {
    throw new Error(`Cross-origin redirect blocked: ${requestedUrl} -> ${finalUrl}`);
  }
}

export function resolveUrl(value: string, baseUrl: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  /*
   * Fragment-only references don't require downloading.
   */
  if (trimmed.startsWith('#')) return null;
  const ignoredProtocols = ['data:', 'blob:', 'mailto:', 'tel:', 'javascript:', 'about:'];
  const lower = trimmed.toLowerCase();
  if (ignoredProtocols.some((protocol) => lower.startsWith(protocol))) return null;

  try {
    const url = new URL(trimmed, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}
