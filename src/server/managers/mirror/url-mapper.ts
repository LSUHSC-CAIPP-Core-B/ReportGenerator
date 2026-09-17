import path from 'node:path';

function sanitizeSegment(value: string): string {
  return value
    .replace(/\0/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\.\./g, '_');
}

function encodeQuery(search: string): string {
  if (!search) return '';
  const value = search
    .slice(1)
    .replace(/[^a-zA-Z0-9._~-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return value ? `__${value}` : '';
}

function safePathname(url: URL): string {
  let pathname = decodeURIComponent(url.pathname);
  pathname = pathname.split('/').map(sanitizeSegment).join('/');
  pathname = pathname.replace(/^[/\\]+/, '');
  if (!pathname || pathname.endsWith('/')) pathname += 'index.html';
  return pathname;
}

export function urlToHtmlPath(url: URL, outputDir: string): string {
  let pathname = safePathname(url);
  const extension = path.extname(pathname);
  if (!extension || extension.toLowerCase() !== '.html') pathname += '.html';
  pathname = pathname.replace(/\.html$/, `${encodeQuery(url.search)}.html`);
  return path.join(outputDir, pathname);
}

export function relativeUrl(fromFile: string, toFile: string): string {
  const value = path.relative(path.dirname(fromFile), toFile);
  if (!value) return './';
  if (value.startsWith('.') || value.startsWith('/') || value.startsWith('\\')) return value;
  return `./${value}`;
}
