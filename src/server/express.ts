import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, sep as PATH_SEPARATOR, resolve } from 'node:path';
import { catchErrorTyped, getParam } from 'common/utilities.ts';
import express, {
  type NextFunction,
  type Request,
  type Response,
  static as staticFiles,
} from 'express';
import { env } from 'server/config/env.ts';
import liquid from 'server/liquidjs/index.ts';
import projects from 'server/managers/projects.ts';
import ts2jsRouter from 'server/middleware/ts2js.ts';
import { UAParser } from 'ua-parser-js';
import { databaseFileByHash, databaseFileByName } from './managers/database.ts';
import { createArchive } from './managers/mirror/index.ts';

const MAPPED_MODULES = new Map([
  ['command-palette', '@sebastian-sereno/command-palette'],
  ['emmet-dom-reconciler', '@sebastian-sereno/emmet-dom-reconciler'],
  ['emmet-optimizer', '@sebastian-sereno/emmet-optimizer'],
]);

const app = express();
const MODULES_DIR = resolve(process.cwd(), 'node_modules');

interface PackageInfo {
  root: string;
  entry: string;
}

const packageCache = new Map<string, PackageInfo>();

function getPackageInfo(identifier: string): PackageInfo {
  const cached = packageCache.get(identifier);
  if (cached) return cached;

  // Resolve the package directory configured in MAPPED_MODULES.
  const configuredPath = resolve(MODULES_DIR, identifier);
  const packageJsonPath = resolve(configuredPath, 'package.json');

  const realPackageJson = realpathSync(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(realPackageJson, 'utf8'));

  // Use the actual package directory, not the node_modules parent.
  const root = realpathSync(dirname(realPackageJson));

  // Choose the package's default entry point.
  const entry =
    (typeof packageJson.browser === 'string' && packageJson.browser) ||
    (typeof packageJson.module === 'string' && packageJson.module) ||
    (typeof packageJson.main === 'string' && packageJson.main) ||
    'index.js';

  const info = { entry, root };
  packageCache.set(identifier, info);

  return info;
}

app.use(express.json());
app.engine('html', liquid.express());
app.set('views', env.ASSETS_DIRECTORY);
app.set('view engine', 'liquid');

app.use('/assets', staticFiles(env.ASSETS_DIRECTORY));

app.use(['/client', '/common'], ts2jsRouter);

app.get('/modules/:module{/*filepath}', (req: Request, res: Response, next: NextFunction) => {
  const moduleName = getParam(req.params.module).toLowerCase();
  if (!MAPPED_MODULES.has(moduleName)) return next();

  const identifier = MAPPED_MODULES.get(moduleName)!;

  try {
    const { root, entry } = getPackageInfo(identifier);

    const rawPath = req.params.filepath;
    const filepath = Array.isArray(rawPath)
      ? rawPath
      : typeof rawPath === 'string'
        ? [rawPath]
        : [];

    // No file path means redirect to the package entry point.
    if (filepath.length === 0) {
      return res.redirect(302, `/modules/${moduleName}/${entry}`);
    }

    const requestPath = resolve(root, ...filepath);
    const realFile = realpathSync(requestPath);

    // Reject absolute paths and traversal outside the package.
    if (
      (requestPath !== root && !requestPath.startsWith(root + PATH_SEPARATOR)) ||
      (realFile !== root && !realFile.startsWith(root + PATH_SEPARATOR))
    ) {
      return res.status(403).json({ error: 'Access Denied' });
    }

    if (!statSync(realFile).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.sendFile(realFile);
  } catch {
    return res.status(404).json({ error: 'Package or file not found' });
  }
});

app.get(['/', '/:identifier'], async (req: Request, res: Response) => {
  const { identifier: projectIds } = req.params;
  const trybuild = req.headers['x-service'] === 'webcrawler';

  // We should realistically never have an array of projects
  const projectId = getParam(projectIds);
  const promised = Promise.resolve(projects.getProject(projectId));
  const [, project] = await catchErrorTyped(promised);

  const reports = await projects.getAllProjects();
  if (req.path !== '/' && !project) return res.redirect('/');

  const parser = new UAParser(req.headers as Record<string, string>);
  const os = { ...parser.getOS() };

  res.render('home.html', {
    os,
    project: project?.report,
    reports,
    timestamp: new Date(),
    trybuild,
  });
});

app.get(
  ['/database/file/:path/:name/@', '/database/file/:path/:name/*relative'],
  databaseFileByName,
);
app.get(
  ['/database/hash/:path/:hash/@', '/database/hash/:path/:hash/*relative'],
  databaseFileByHash,
);

// curl -XPOST -H "Content-type: application/json" -d '{"url": "http://localhost:3000/url"}' -O 'http://localhost:3000/archive'
app.post('/archive', createArchive);

export default app;
