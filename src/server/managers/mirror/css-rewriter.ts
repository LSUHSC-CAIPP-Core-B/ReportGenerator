import { readFileSync, writeFileSync } from 'node:fs';
import { downloadResource } from './downloader.ts';
import type { CrawlContext } from './types.ts';
import { relativeUrl } from './url-mapper.ts';
import { isAllowedOrigin, normalizeUrl, resolveUrl } from './url-policy.ts';

export async function rewriteCssFile(
  filePath: string,
  cssUrl: string,
  context: CrawlContext,
): Promise<void> {
  const css = readFileSync(filePath, 'utf8');
  const rewritten = await rewriteCss(css, cssUrl, filePath, context);
  if (rewritten !== css) writeFileSync(filePath, rewritten, 'utf8');
}

export async function rewriteCss(
  css: string,
  baseUrl: string,
  localFilePath: string,
  context: CrawlContext,
): Promise<string> {
  const regex = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  const matches = [...css.matchAll(regex)];
  let result = css;

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const value = match[2]?.trim();
    if (!value) continue;

    const absolute = resolveUrl(value, baseUrl);
    if (!absolute) continue;

    const parsed = new URL(absolute);
    /*
     * Third-party CSS dependencies remain external.
     */
    if (!isAllowedOrigin(parsed.href, context.origin)) continue;
    const cleanUrl = normalizeUrl(parsed.href, context.options);

    try {
      const resource = await downloadResource(cleanUrl, context);
      if (!resource || resource.kind !== 'asset') continue;

      const localReference = relativeUrl(localFilePath, resource.filePath);
      const replacement = `url("${localReference}")`;
      const start = match.index ?? 0;
      result = result.slice(0, start) + replacement + result.slice(start + match[0].length);
    } catch (error) {
      console.warn(`Failed to rewrite CSS URL ${value}:`, error);
    }
  }

  return result;
}
