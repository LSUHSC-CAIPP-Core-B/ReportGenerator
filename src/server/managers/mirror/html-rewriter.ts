import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { rewriteCss, rewriteCssFile } from './css-rewriter.ts';
import { downloadResource } from './downloader.ts';
import type { CrawlContext, DownloadedResource } from './types.ts';
import { relativeUrl, urlToHtmlPath } from './url-mapper.ts';
import { isAllowedOrigin, normalizeUrl, resolveUrl } from './url-policy.ts';

export async function processHtml(
  html: string,
  requestedUrl: string,
  finalUrl: string,
  context: CrawlContext,
): Promise<DownloadedResource> {
  const parsedUrl = new URL(finalUrl);
  const filePath = urlToHtmlPath(parsedUrl, context.outputDir);
  const resource: DownloadedResource = {
    contentType: 'text/html',
    filePath,
    finalUrl,
    kind: 'html',
    requestedUrl,
  };

  context.resources.set(requestedUrl, resource);
  context.resources.set(finalUrl, resource);
  const $ = cheerio.load(html);
  let baseUrl = finalUrl;

  /*
   * Resolve <base> before removing it.
   */
  const base = $('base[href]').first();

  if (base.length) {
    const href = base.attr('href');
    if (href) {
      const resolved = resolveUrl(href, finalUrl);
      if (resolved && isAllowedOrigin(resolved, context.origin)) {
        baseUrl = resolved;
      }
    }
  }

  /*
   * The local mirror must not retain <base>,
   * otherwise browser URL resolution can escape
   * the generated filesystem structure.
   */
  $('base').remove();
  await rewriteNavigation($, baseUrl, filePath, context);
  await rewriteAssets($, baseUrl, filePath, context);
  await rewriteSrcsets($, baseUrl, filePath, context);

  /*
   * Inline style attributes.
   */
  for (const element of $('[style]').toArray()) {
    const value = $(element).attr('style');
    if (!value) continue;
    const rewritten = await rewriteCss(value, baseUrl, filePath, context);
    $(element).attr('style', rewritten);
  }

  /*
   * Inline <style> blocks.
   */
  for (const element of $('style').toArray()) {
    const css = $(element).html();
    if (!css) continue;

    const rewritten = await rewriteCss(css, baseUrl, filePath, context);
    $(element).html(rewritten);
  }

  const output = $.html();

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, output, 'utf8');
  return resource;
}

async function rewriteNavigation(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  currentFile: string,
  context: CrawlContext,
) {
  const elements = $('a[href], area[href], form[action]').toArray();

  for (const element of elements) {
    const attr = element.name === 'form' ? 'action' : 'href';
    const value = $(element).attr(attr);
    if (!value) continue;
    if (value.trim().startsWith('#')) continue;

    const absolute = resolveUrl(value, baseUrl);
    if (!absolute) continue;

    const parsed = new URL(absolute);
    if (!isAllowedOrigin(parsed.href, context.origin)) continue;
    const cleanUrl = normalizeUrl(parsed.href, context.options);
    context.queuePage(cleanUrl);
    const target = context.resources.get(cleanUrl);

    const targetPath =
      target?.kind === 'html' && target.filePath
        ? target.filePath
        : urlToHtmlPath(new URL(cleanUrl), context.outputDir);

    const relative = relativeUrl(currentFile, targetPath);
    $(element).attr(attr, relative + parsed.hash);
  }
}

async function rewriteAssets(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  currentFile: string,
  context: CrawlContext,
) {
  const selectors = [
    ['img[src]', 'src'],
    ['iframe[src]', 'src'],
    ['script[src]', 'src'],
    ['link[href]', 'href'],
    ['source[src]', 'src'],
    ['video[src]', 'src'],
    ['audio[src]', 'src'],
    ['track[src]', 'src'],
    ['object[data]', 'data'],
    ['embed[src]', 'src'],
    ['input[src]', 'src'],
  ] as const;

  for (const [selector, attr] of selectors) {
    for (const element of $(selector).toArray()) {
      const value = $(element).attr(attr);
      if (!value) continue;

      const absolute = resolveUrl(value, baseUrl);
      if (!absolute) continue;

      const parsed = new URL(absolute);

      /*
       * Never download external-origin assets.
       */
      if (!isAllowedOrigin(parsed.href, context.origin)) continue;
      const cleanUrl = normalizeUrl(parsed.href, context.options);

      try {
        const resource = await downloadResource(cleanUrl, context);
        if (!resource) continue;

        if (resource.kind === 'html') {
          context.queuePage(cleanUrl);
          const targetPath = resource.filePath || urlToHtmlPath(parsed, context.outputDir);
          $(element).attr(attr, relativeUrl(currentFile, targetPath));
          continue;
        }

        $(element).attr(attr, relativeUrl(currentFile, resource.filePath));
        // if (isCss(resource.contentType)) {}
      } catch (error) {
        console.warn(`Failed to process ${absolute}:`, error);
      }
    }
  }
}

async function rewriteSrcsets(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  currentFile: string,
  context: CrawlContext,
) {
  for (const element of $('[srcset]').toArray()) {
    const value = $(element).attr('srcset');
    if (!value) continue;

    const candidates = parseSrcset(value);
    const rewritten: string[] = [];

    for (const candidate of candidates) {
      const absolute = resolveUrl(candidate.url, baseUrl);

      if (!absolute) {
        rewritten.push(candidate.original);
        continue;
      }

      const parsed = new URL(absolute);
      if (!isAllowedOrigin(parsed.href, context.origin)) {
        rewritten.push(candidate.original);
        continue;
      }

      try {
        const resource = await downloadResource(
          normalizeUrl(parsed.href, context.options),
          context,
        );

        if (!resource || resource.kind !== 'asset') {
          rewritten.push(candidate.original);
          continue;
        }

        rewritten.push(
          [relativeUrl(currentFile, resource.filePath), candidate.descriptor]
            .filter(Boolean)
            .join(' '),
        );
      } catch {
        rewritten.push(candidate.original);
      }
    }

    $(element).attr('srcset', rewritten.join(', '));
  }
}

function parseSrcset(value: string): Array<{
  url: string;
  descriptor: string;
  original: string;
}> {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/\s+/);

      return {
        descriptor: parts.join(' '),
        original: entry,
        url: parts.shift() || '',
      };
    });
}

function isCss(contentType: string): boolean {
  return contentType.split(';', 1)[0].trim().toLowerCase() === 'text/css';
}
