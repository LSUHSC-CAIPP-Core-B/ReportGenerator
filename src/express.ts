import path from 'node:path';
import express, { type Request, type Response, static as staticFiles } from 'express';
import liquid from './liquidjs'
import { jsonDatabase } from './projects';
import { ProjectReport } from './projects/types';
import { TEMPLATE_DIRECTORY } from './constants';
import { ProjectsDrop } from './liquidjs/drops/projects';

const app = express();

app.engine('html', liquid.express());
app.set('views', path.resolve(TEMPLATE_DIRECTORY));
app.set('view engine', 'liquid');
app.use('/assets', staticFiles(`${TEMPLATE_DIRECTORY}/assets`));

app.get('/', (req: Request, res: Response) => {
  res.render('builtin/home.html', {
    timestamp: (new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    projects: new ProjectsDrop()
  });
});

app.get('/:identifier', async (req: Request, res: Response) => {
  const identifier = (req.params.identifier as string)
    .toLowerCase();

  jsonDatabase.getObject<ProjectReport>(identifier)
    .then((project) => {
      res.render('builtin/project.html', {
        timestamp: (new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        project
      });
    }).catch((err) => {
      res.render('builtin/home.html', {
        timestamp: (new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        projects: new ProjectsDrop()
      });
    })
});

app.get('/:identifier/new', async (req: Request, res: Response) => {
  const identifier = (req.params.identifier as string)
    .toLowerCase();

  const projectReport: ProjectReport = {
    title: identifier.toUpperCase(),
    last_opened: new Date()
  };

  jsonDatabase.push(`/${identifier}`, projectReport, false)
    .catch(err => jsonDatabase.getObject<ProjectReport>(identifier))
    .then(project => { if (project == null) throw new Error("Couldn't find project"); return project; })
    .then(project => {
      res.render('builtin/project.html', {
        timestamp: (new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        project
      });
    }).catch(err => {
      res.redirect(`/${identifier}`);

      // res.render('builtin/home.html', {
      //   timestamp: (new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      //   projects: new ProjectsDrop(),
      //   error: err
      // });
    })
});

export default app;
