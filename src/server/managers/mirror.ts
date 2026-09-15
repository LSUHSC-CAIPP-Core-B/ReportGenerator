import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import * as cheerio from 'cheerio';
import type { NextFunction, Request, Response } from 'express';

export async function createArchive(req: Request, res: Response, next: NextFunction) {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const jobId = randomUUID();
  const outputDir = path.join('/tmp', `mirror-${jobId}`);

  try {
    mkdirSync(outputDir, { recursive: true });

    const zipPath = `${outputDir}.zip`;
    await mirrorWebsite(url, outputDir);
    await createZip(outputDir, zipPath);

    res.download(zipPath, 'website.zip', async () => {
      rmSync(outputDir, { force: true, recursive: true });
      rmSync(zipPath, { force: true });
    });
  } catch (err) {
    console.error(err);
    rmSync(outputDir, { force: true, recursive: true });
    res.status(500).json({ error: 'Failed to mirror website' });
  }
}

export async function mirrorWebsite(startUrl: string, outputDir: string) {
  const rootUrl = new URL(startUrl);

  // Only crawl this origin.
  const origin = rootUrl.origin;

  const visited = new Set();
  const queued = new Set();

  const queue = [rootUrl.href];
  queued.add(rootUrl.href);

  mkdirSync(outputDir, { recursive: true });

  while (queue.length > 0) {
    const currentUrl = queue.shift();

    if (!currentUrl) break;
    if (visited.has(currentUrl)) continue;

    visited.add(currentUrl);

    try {
      console.log(`Downloading: ${currentUrl}`);

      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'WebsiteMirror/1.0',
          'X-Service': 'webcrawler',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        console.warn(`Skipping ${currentUrl}: HTTP ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const filePath = urlToFilePath(new URL(currentUrl), outputDir);

      if (contentType.includes('text/html')) {
        let html = await response.text();
        const $ = cheerio.load(html);
        const resources: { element: any; attr: string; url: string }[] = [];

        $('img[src], iframe[src], img[aria-table], script[src], link[href], source[src]').each(
          (_, element) => {
            const attr =
              element.name === 'link' ? 'href' : element.name === 'div' ? 'aria-table' : 'src';

            const value = $(element).attr(attr);
            if (!value) return;

            const absoluteUrl = resolveUrl(value, currentUrl);
            if (!absoluteUrl) return;

            resources.push({
              attr,
              element,
              url: absoluteUrl,
            });
          },
        );

        $('a[href]').each((_, element) => {
          const href = $(element).attr('href');
          if (!href) return;

          const absoluteUrl = resolveUrl(href, currentUrl);
          if (!absoluteUrl) return;

          // Only crawl our own origin.
          if (new URL(absoluteUrl).origin !== origin) return;

          // Remove fragments.
          const cleanUrl = removeHash(absoluteUrl);

          if (!queued.has(cleanUrl)) {
            queued.add(cleanUrl);
            queue.push(cleanUrl);
          }

          const targetPath = urlToFilePath(new URL(cleanUrl), outputDir);
          const relativePath = path.relative(path.dirname(filePath), targetPath);
          $(element).attr('href', ensureRelative(relativePath));
        });

        for (const resource of resources) {
          const resourceUrl = removeHash(resource.url);

          // Don't download resources from another origin.
          if (new URL(resourceUrl).origin !== origin) continue;

          const resourceFilePath = urlToFilePath(new URL(resourceUrl), outputDir);
          const relativePath = path.relative(path.dirname(filePath), resourceFilePath);
          $(resource.element).attr(resource.attr, ensureRelative(relativePath));

          if (!queued.has(resourceUrl)) {
            queued.add(resourceUrl);
            queue.push(resourceUrl);
          }
        }

        html = $.html();

        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, html, 'utf8');
      } else {
        const buffer = Buffer.from(await response.arrayBuffer());
        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, buffer);
      }
    } catch (error) {
      console.error(`Failed to download ${currentUrl}:`, (error as any).message);
    }
  }

  console.log(`Mirror complete. Downloaded ${visited.size} URLs.`);
}

function urlToFilePath(url: URL, outputDir: string) {
  let pathname = decodeURIComponent(url.pathname);

  pathname = pathname.replace(/\0/g, '');

  if (pathname === '/') pathname = '/index.html';
  else if (pathname.endsWith('/')) pathname += 'index.html';
  else {
    const basename = path.basename(pathname);
    if (!path.extname(basename)) pathname += '/index.html';
  }

  if (url.search) {
    const ext = path.extname(pathname);
    const base = ext ? pathname.slice(0, -ext.length) : pathname;
    const query = url.search.slice(1).replace(/[^a-zA-Z0-9_-]/g, '_');

    pathname = `${base}__${query}${ext}`;
  }

  return path.join(outputDir, pathname.replace(/^[/\\]+/, ''));
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    const trimmed = value.trim();

    // Don't try to download these.
    if (
      trimmed.startsWith('#') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('javascript:')
    )
      return null;

    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

function removeHash(url: string) {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.href;
}

function ensureRelative(value: string) {
  if (value.startsWith('.')) return value;
  return `./${value}`;
}

export function createZip(sourceDir: string, outputFile: string) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputFile);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => {
      console.log(`ZIP created: ${outputFile} (${archive.pointer()} bytes)`);
      resolve(outputFile);
    });
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
