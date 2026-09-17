import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { rewriteCssFile } from './css-rewriter.ts';
import { downloadResource } from './downloader.ts';
import { processHtml } from './html-rewriter.ts';
import type { CrawlContext, DownloadedResource, HttpClient, MirrorOptions } from './types.ts';
import { isAllowedOrigin, normalizeUrl } from './url-policy.ts';

const DEFAULTS = {
  concurrency: 4,
  maxPages: 10_000,
  maxResponseBytes: 50 * 1024 * 1024,
  preserveQueryString: true,
  timeoutMs: 30_000,
} as const;

export async function mirrorWebsite(
  startUrl: string,
  outputDir: string,
  options: Partial<Omit<MirrorOptions, 'origin' | 'outputDir'>> = {},
  http: HttpClient = {
    fetch(url, init) {
      return fetch(url, init);
    },
  },
) {
  const start = new URL(startUrl);

  if (start.protocol !== 'http:' && start.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }

  const config: Required<MirrorOptions> = {
    origin: start.origin,
    outputDir,

    ...DEFAULTS,
    ...options,
  };

  mkdirSync(outputDir, { recursive: true });
  const assetsDir = path.join(outputDir, 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const context: CrawlContext = {
    assetsDir,
    hashes: new Map(),

    http,
    inFlight: new Map(),
    options: config,

    origin: new URL(config.origin),

    outputDir,

    queue: [],
    queued: new Set(),

    queuePage(url) {
      enqueue(url, context);
    },

    resources: new Map(),
    visited: new Set(),
  };

  enqueue(normalizeUrl(start.href, config), context);

  while (context.queue.length > 0) {
    if (context.visited.size >= config.maxPages) {
      console.warn(`Maximum page limit reached: ${config.maxPages}`);
      break;
    }

    const batch = context.queue.splice(0, config.concurrency);

    await Promise.all(
      batch.map(async (url) => {
        if (context.visited.has(url)) return;
        context.visited.add(url);

        try {
          await crawlPage(url, context);
        } catch (error) {
          console.error(`Failed to crawl ${url}:`, error instanceof Error ? error.message : error);
        }
      }),
    );
  }

  console.log(
    `Mirror complete. ` +
      `Visited ${context.visited.size} pages. ` +
      `Stored ${context.hashes.size} unique assets.`,
  );

  return context;
}

async function crawlPage(url: string, context: CrawlContext) {
  if (!isAllowedOrigin(url, context.origin)) return;

  console.log(`Crawling: ${url}`);
  const resource = await downloadResource(url, context);
  if (!resource) return;

  await processDownloadedAsset(resource, context);
  if (resource.kind !== 'html' || resource.body == null) return;
  await processHtml(resource.body, url, resource.finalUrl, context);
}

async function processDownloadedAsset(resource: DownloadedResource, context: CrawlContext) {
  if (resource.kind !== 'asset' || !resource.filePath) return;
  if (resource.contentType.split(';', 1)[0].trim().toLowerCase() !== 'text/css') return;
  await rewriteCssFile(resource.filePath, resource.finalUrl, context);
}

function enqueue(url: string, context: CrawlContext) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return;
  }

  if (!isAllowedOrigin(parsed.href, context.origin)) return;
  const clean = normalizeUrl(parsed.href, context.options);
  if (context.visited.has(clean) || context.queued.has(clean)) return;

  context.queued.add(clean);
  context.queue.push(clean);
  console.log(`Queued: ${clean}`);
}
