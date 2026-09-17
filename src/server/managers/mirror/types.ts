export type ResourceKind = 'html' | 'asset';

export interface DownloadedResource {
  requestedUrl: string;
  finalUrl: string;
  filePath: string;
  contentType: string;
  hash?: string;
  kind: ResourceKind;

  /**
   * Populated only for HTML resources.
   */
  body?: string;
}

export interface MirrorOptions {
  origin: string;
  outputDir: string;

  maxPages?: number;
  maxResponseBytes?: number;
  concurrency?: number;
  timeoutMs?: number;
  preserveQueryString?: boolean;
}

export interface HttpClient {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export interface CrawlContext {
  options: Required<MirrorOptions>;

  origin: URL;

  outputDir: string;
  assetsDir: string;

  queue: string[];
  queued: Set<string>;
  visited: Set<string>;

  resources: Map<string, DownloadedResource>;
  hashes: Map<string, string>;

  /**
   * Prevents duplicate simultaneous requests.
   */
  inFlight: Map<string, Promise<DownloadedResource | null>>;

  http: HttpClient;

  queuePage(url: string): void;
}
