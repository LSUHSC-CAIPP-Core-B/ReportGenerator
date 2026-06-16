import { createReadStream, existsSync, statSync } from 'node:fs';
import { join as joinPath } from 'node:path';
import express, { type Request, type Response, static as staticFiles } from 'express';
import { Types } from 'mongoose';
import { UAParser } from 'ua-parser-js';
import { ProjectError } from '../shared/index.ts';
import { ASSETS_DIRECTORY } from './constants.ts';
import { ProjectModel } from './database/schemas.ts';
import liquid from './liquidjs/index.ts';
import ts2jsRouter from './middleware/ts2js.ts';
import projects from './projects/index.ts';
import { catchErrorTyped, getParam } from './utilities.ts';

const app = express();

app.engine('html', liquid.express());
app.set('views', ASSETS_DIRECTORY);
app.set('view engine', 'liquid');
app.use('/assets', staticFiles(ASSETS_DIRECTORY));

app.use(['/client', '/shared'], ts2jsRouter);

app.get(['/', '/:identifier'], async (req: Request, res: Response) => {
  const { identifier: projectIds } = req.params;

  // We should realistically never have an array of projects
  const projectId = Array.isArray(projectIds) ? projectIds[0] : projectIds;
  const promised =
    projectId === undefined ? Promise.resolve(undefined) : projects.getProject(projectId);
  const [, project] = await catchErrorTyped(promised);

  const reports = await projects.getAllProjects();

  if (req.path !== '/' && !project) return res.redirect('/');

  const parser = new UAParser(req.headers as Record<string, string>);
  const os = { ...parser.getOS() };

  res.render('home.html', { os, project, reports, timestamp: new Date() });
});

app.delete('/:identifier', async (req: Request, res: Response) => {
  const { identifier: projectId } = req.params;

  // We should realistically never have an array of projects
  // const projectId = Array.isArray(projectIds) ? projectIds[0] : projectIds;

  const [error] = await catchErrorTyped(projects.deleteProject(projectId as string), [
    ProjectError,
  ]);

  if (error) res.json({ message: error.message, status: 400 });
  else res.json({ message: 'OK', status: 200 });
});

app.get(
  ['/database/:project/:file/$', '/database/:project/:file/*relative'],
  async (req: Request, res: Response) => {
    const { project: projectIdArr, file: fileIdArr, relative: relatives } = req.params;

    const projectIdStr = getParam(projectIdArr);
    const fileIdStr = getParam(fileIdArr);

    if (!projectIdStr.match(/^[a-f\d]{24}$/gi))
      return res.json({ message: 'Project ID needs to be a 24 character hex', status: 400 });
    if (!fileIdStr.match(/^[a-f\d]{24}$/gi))
      return res.json({ message: 'File ID needs to be a 24 character hex', status: 400 });

    const projectId = Types.ObjectId.createFromHexString(projectIdStr);
    const fileId = Types.ObjectId.createFromHexString(fileIdStr);

    const additional =
      relatives != null ? (Array.isArray(relatives) ? relatives : [relatives]) : [];

    if (additional.length > 0) additional.unshift('..');

    const lookup = await ProjectModel.aggregate([
      { $match: { _id: projectId } },
      { $unwind: '$files' },
      { $match: { files: fileId } },
      {
        $lookup: {
          as: 'file',
          foreignField: '_id',
          from: 'files',
          localField: 'files',
        },
      },
      { $unwind: '$file' },
      { $limit: 1 },
    ]);

    const path = joinPath(lookup[0].file.path, ...additional);
    const fileLookup = joinPath(lookup[0].absolutePath, path);

    if (fileLookup.endsWith('glimma.min.css')) {
      const injectedCSS = joinPath(ASSETS_DIRECTORY, 'css', 'iframe.css');

      const status = existsSync(fileLookup) ? 200 : 404;
      const statSize = statSync(fileLookup).size + statSync(injectedCSS).size;

      res.writeHead(status, {
        'Content-Length': statSize,
        'Content-Type': 'text/css',
      });

      // Create first read stream
      const stream1 = createReadStream(fileLookup);

      // Pipe first stream, do not end response yet
      stream1.pipe(res, { end: false });

      // When first stream ends, start second
      stream1.on('end', () => {
        const stream2 = createReadStream(injectedCSS);
        // Pipe second stream and end response
        stream2.pipe(res);
      });

      // Handle errors
      stream1.on('error', (err) => res.status(500).send(err.message));
    } else res.sendFile(fileLookup);
  },
);

export default app;
