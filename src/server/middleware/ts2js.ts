import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type NextFunction, type Request, type Response, Router } from 'express';
import { env } from 'server/config/env.ts';
import ts from 'typescript';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const TMP_DIR = path.join(tmpdir(), env.APP_NAME, 'client-cache');

const router = Router();

/**
 * Ensure temp cache directory exists once at startup
 */
fs.mkdirSync(TMP_DIR, { recursive: true });

/**
 * Compile a TS file to JS and persist it to cache
 */
function compileTsFile(srcPath: string, outPath: string): string {
  const source = fs.readFileSync(srcPath, 'utf8');

  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      sourceMap: false, // enable if you actually serve maps
      target: ts.ScriptTarget.ES2020,
    },
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outputText, 'utf8');

  return outputText;
}

/**
 * Dev-only TS → JS middleware
 */
router.get('/*path', (req: Request, res: Response, next: NextFunction) => {
  const { originalUrl: requestPath } = req;
  const ext = /(\.ts|(?<!\.\w+))$/gi;

  if (requestPath.match(ext)) {
    return res.redirect(requestPath.replace(ext, '.js'));
  }

  //   const { path: $pathParam } = params;
  //   const $pathParamArr = Array.isArray($pathParam) ? $pathParam : [$pathParam];
  //   const requestPath = path.join(...$pathParamArr);

  const srcPath = path.join(SRC_DIR, requestPath.replace(/\.js$/i, '.ts'));
  const outPath = path.join(TMP_DIR, requestPath);

  if (!fs.existsSync(srcPath)) return next();

  const srcMtime = fs.statSync(srcPath).mtimeMs;

  let shouldRebuild = true;

  if (fs.existsSync(outPath)) {
    const outMtime = fs.statSync(outPath).mtimeMs;
    shouldRebuild = srcMtime > outMtime;
  }

  if (shouldRebuild) compileTsFile(srcPath, outPath);

  res.type('application/javascript');
  res.sendFile(outPath);
});

export default router;
