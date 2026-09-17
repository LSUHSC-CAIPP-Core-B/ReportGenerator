import { saveAsset } from './resource-store.ts';
import type { CrawlContext, DownloadedResource } from './types.ts';
import { assertAllowedFinalUrl, normalizeUrl } from './url-policy.ts';

export async function downloadResource(
  requestedUrl: string,
  context: CrawlContext,
): Promise<DownloadedResource | null> {
  const normalized = normalizeUrl(requestedUrl, context.options);
  const existing = context.resources.get(normalized);
  const cssQueue: DownloadedResource[] = [];

  if (existing) return existing;
  const inFlight = context.inFlight.get(normalized);
  if (inFlight) return inFlight;

  const request = performDownload(normalized, context);
  context.inFlight.set(normalized, request);

  try {
    return await request;
  } finally {
    context.inFlight.delete(normalized);
  }
}

async function performDownload(
  requestedUrl: string,
  context: CrawlContext,
): Promise<DownloadedResource | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), context.options.timeoutMs);

  try {
    const response = await context.http.fetch(requestedUrl, {
      headers: {
        'User-Agent': 'WebsiteMirror/1.0',
        'X-Service': 'webcrawler',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`Skipping ${requestedUrl}: HTTP ${response.status}`);
      return null;
    }

    const finalUrl = normalizeUrl(response.url || requestedUrl, context.options);

    /*
     * This check happens AFTER redirects.
     */
    assertAllowedFinalUrl(requestedUrl, finalUrl, context.origin);
    const contentType = response.headers.get('content-type') || '';

    if (isHtml(contentType)) {
      const body = await response.text();

      const resource: DownloadedResource = {
        body,
        contentType,
        filePath: '',
        finalUrl,
        kind: 'html',
        requestedUrl,
      };

      context.resources.set(requestedUrl, resource);
      context.resources.set(finalUrl, resource);
      return resource;
    }

    const buffer = await readResponseBody(response, context.options.maxResponseBytes);
    const resource = saveAsset(buffer, finalUrl, contentType, context);
    resource.requestedUrl = requestedUrl;
    resource.finalUrl = finalUrl;
    context.resources.set(requestedUrl, resource);
    context.resources.set(finalUrl, resource);

    return resource;
  } finally {
    clearTimeout(timeout);
  }
}

function isHtml(contentType: string): boolean {
  return contentType.split(';', 1)[0].trim().toLowerCase() === 'text/html';
}

async function readResponseBody(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = response.headers.get('content-length');

  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`Response exceeds ${maxBytes} byte limit`);
  }

  const reader = response.body?.getReader();
  if (!reader) return Buffer.from(await response.arrayBuffer());

  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;

      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Response exceeds ${maxBytes} byte limit`);
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}
