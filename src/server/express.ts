import { catchErrorTyped, getParam } from 'common/utilities.ts';
import express, { type Request, type Response, static as staticFiles } from 'express';
import { env } from 'server/config/env.ts';
import liquid from 'server/liquidjs/index.ts';
import projects from 'server/managers/projects.ts';
import ts2jsRouter from 'server/middleware/ts2js.ts';
import { UAParser } from 'ua-parser-js';
import { databaseFileByHash, databaseFileByName } from './managers/database.ts';
import { createArchive } from './managers/mirror.ts';

const app = express();

app.use(express.json());
app.engine('html', liquid.express());
app.set('views', env.ASSETS_DIRECTORY);
app.set('view engine', 'liquid');

app.use('/assets', staticFiles(env.ASSETS_DIRECTORY));

app.use(['/client', '/common'], ts2jsRouter);

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
