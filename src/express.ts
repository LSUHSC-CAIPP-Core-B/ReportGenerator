import path from 'node:path';
import express, { type Request, type Response, static as staticFiles } from 'express';
import liquid from './liquidjs'
import projects, { reduceReport } from './projects';
import { TEMPLATE_DIRECTORY } from './constants';
import { catchErrorTyped } from './utilities';
import { ProjectError } from './projects/types';

const app = express();

app.engine('html', liquid.express());
app.set('views', path.resolve(TEMPLATE_DIRECTORY));
app.set('view engine', 'liquid');
app.use('/assets', staticFiles(`${TEMPLATE_DIRECTORY}/assets`));

app.get([ '/', '/:identifier' ], async (req: Request, res: Response) => {
  const { identifier: projectIds } = req.params;

  // We should realistically never have an array of projects
  const projectId = Array.isArray(projectIds) ? projectIds[0] : projectIds;
  const project = await projects.getProject(projectId);

  const allProjects = await projects.getAllProjects();
  const reports = allProjects.map(reduceReport);

  projects.getProject(req.params.identifier as string);

  res.render('builtin/home.html', {
    timestamp: new Date(),
    project, reports
  });
});

app.delete('/:identifier', async (req: Request, res: Response) => {
  const { identifier: projectIds } = req.params;

  // We should realistically never have an array of projects
  const projectId = Array.isArray(projectIds) ? projectIds[0] : projectIds;

  const [ error ] = await catchErrorTyped(
    projects.deleteProject(projectId),
    [ ProjectError ]
  );

  if (error) res.json({ status: 400, message: error.message });
  else res.json({ status: 200, message: 'OK' });
});

export default app;
