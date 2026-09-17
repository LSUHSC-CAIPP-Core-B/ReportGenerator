import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CrawlContext, DownloadedResource } from './types.ts';

export function saveAsset(
  buffer: Buffer,
  url: string,
  contentType: string,
  context: CrawlContext,
): DownloadedResource {
  const hash = createHash('sha256').update(buffer).digest('hex');
  const existingPath = context.hashes.get(hash);
  if (existingPath) {
    return {
      contentType,
      filePath: existingPath,
      finalUrl: url,
      hash,
      kind: 'asset',
      requestedUrl: url,
    };
  }

  const parsed = new URL(url);
  const extension = extensionFor(parsed.pathname, contentType);
  const fileName = `${hash}${extension}`;
  const filePath = path.join(context.assetsDir, fileName);

  mkdirSync(context.assetsDir, { recursive: true });
  writeFileSync(filePath, buffer);
  context.hashes.set(hash, filePath);

  return {
    contentType,
    filePath,
    finalUrl: url,
    hash,
    kind: 'asset',
    requestedUrl: url,
  };
}

function extensionFor(pathname: string, contentType: string): string {
  const pathnameExtension = path.extname(pathname);

  if (pathnameExtension && /^[.][a-zA-Z0-9]{1,10}$/.test(pathnameExtension)) {
    return pathnameExtension.toLowerCase();
  }

  const mime = contentType.split(';', 1)[0].trim().toLowerCase();
  const extensions: Record<string, string> = {
    'application/javascript': '.js',
    'application/json': '.json',
    'application/pdf': '.pdf',
    'application/wasm': '.wasm',
    'font/woff': '.woff',
    'font/woff2': '.woff2',
    'image/avif': '.avif',
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'text/css': '.css',
    'text/javascript': '.js',
  };

  return extensions[mime] ?? '';
}
