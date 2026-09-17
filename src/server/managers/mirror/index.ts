import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { mirrorWebsite } from './crawler.ts';
import { createZip } from './zip.ts';

export async function createArchive(req: Request, res: Response, next: NextFunction) {
  const value = req.body?.url;

  if (typeof value !== 'string' || !value.trim()) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  let startUrl: URL;

  try {
    startUrl = new URL(value.trim());
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  if (startUrl.protocol !== 'http:' && startUrl.protocol !== 'https:') {
    res.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported' });
    return;
  }

  const jobId = randomUUID();
  const outputDir = path.join('/tmp', `mirror-${jobId}`);
  const zipPath = `${outputDir}.zip`;

  try {
    // await mirrorWebsite(startUrl.href, outputDir, {
    //   concurrency: 4,
    //   maxPages: 10_000,
    //   maxResponseBytes: 50 * 1024 * 1024,
    //   preserveQueryString: true,
    //   timeoutMs: 30_000,
    // });
    await mirrorWebsite(startUrl.href, outputDir);
    await createZip(outputDir, zipPath);
    res.download(zipPath, 'website.zip', async (error) => {
      await Promise.allSettled([
        rm(outputDir, { force: true, recursive: true }),
        rm(zipPath, { force: true }),
      ]);

      if (error) {
        if (!res.headersSent) next(error);
        return;
      }
    });
  } catch (error) {
    console.error('Website mirror failed:', error);

    await Promise.allSettled([
      rm(outputDir, { force: true, recursive: true }),
      rm(zipPath, { force: true }),
    ]);

    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).json({ error: 'Failed to mirror website' });
  }
}
