import { createReadStream, existsSync, statSync } from 'node:fs';
import { join as joinPath } from 'node:path';
import { getParam } from 'common/utilities.ts';
import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { env } from 'server/config/env.ts';
import { ProjectModel } from 'server/database/schemas.ts';
import projects from 'server/managers/projects.ts';

async function serveDatabaseFile(
  res: Response,
  lookup: {
    file: {
      path: string;
    };
    absolutePath: string;
  },
  relatives: string | string[] | undefined,
) {
  const additional = relatives != null ? (Array.isArray(relatives) ? relatives : [relatives]) : [];

  if (additional.length > 0) additional.unshift('..');

  const path = joinPath(lookup.file.path, ...additional);
  const fileLookup = joinPath(lookup.absolutePath, path);

  if (fileLookup.endsWith('glimma.min.css')) {
    const injectedCSS = joinPath(env.ASSETS_DIRECTORY, 'css', 'iframe.css');

    if (!existsSync(fileLookup)) return res.status(404).end();

    const statSize = statSync(fileLookup).size + statSync(injectedCSS).size;

    res.writeHead(200, {
      'Content-Length': statSize,
      'Content-Type': 'text/css',
    });

    const stream1 = createReadStream(fileLookup);

    stream1.pipe(res, { end: false });

    stream1.on('end', () => {
      const stream2 = createReadStream(injectedCSS);
      stream2.pipe(res);
    });

    stream1.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).send(err.message);
      } else {
        res.destroy(err);
      }
    });
  } else {
    res.sendFile(fileLookup);
  }
}

/**
 * GET /database/:path/:name/:relative?
 *
 * Looks up the file by its name.
 */
export async function databaseFileByName(req: Request, res: Response, next: NextFunction) {
  const { path: pathArr, name: nameArr, relative: relatives } = req.params;
  const projectPath = getParam(pathArr);
  const fileName = getParam(nameArr);

  const project = (await projects.getProject(projectPath))!;
  const projectIdStr = project.report.project ?? '';

  if (!/^[a-f\d]{24}$/i.test(projectIdStr)) {
    res.status(400).json({ message: 'Project ID needs to be a 24 character hex', status: 400 });
    return;
  }

  const projectId = Types.ObjectId.createFromHexString(projectIdStr);
  const escapedName = fileName.replaceAll(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll(/\*/g, '.*');

  const lookup = await ProjectModel.aggregate(
    [
      { $match: { _id: projectId } },
      { $unwind: '$files' },
      { $lookup: { as: 'file', foreignField: '_id', from: 'files', localField: 'files' } },
      { $unwind: '$file' },
      { $match: { 'file.path': { $options: 'i', $regex: `${escapedName}$` } } },
      { $limit: 1 },
    ],
    { maxTimeMS: 3000 },
  );

  if (!lookup[0]?.file) {
    return res.status(404).json({ message: 'File not found', status: 404 });
  }

  return serveDatabaseFile(res, lookup[0], relatives);
}

/**
 * GET /database/:path/:hash/:relative?
 *
 * Looks up the file by its hash/ObjectId.
 */
export async function databaseFileByHash(req: Request, res: Response) {
  const { path: pathArr, hash: fileIdArr, relative: relatives } = req.params;

  const projectPath = getParam(pathArr);
  const fileIdStr = getParam(fileIdArr);

  const project = (await projects.getProject(projectPath))!;
  const projectIdStr = project.report.project ?? '';

  if (!/^[a-f\d]{24}$/i.test(projectIdStr)) {
    return res.json({
      message: 'Project ID needs to be a 24 character hex',
      status: 400,
    });
  }

  if (!/^[a-f\d]{24}$/i.test(fileIdStr)) {
    return res.json({
      message: 'File ID needs to be a 24 character hex',
      status: 400,
    });
  }

  const projectId = Types.ObjectId.createFromHexString(projectIdStr);
  const fileId = Types.ObjectId.createFromHexString(fileIdStr);

  const lookup = await ProjectModel.aggregate(
    [
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
    ],
    { maxTimeMS: 3000 },
  );

  if (!lookup[0]?.file) {
    return res.status(404).json({
      message: 'File not found',
      status: 404,
    });
  }

  return serveDatabaseFile(res, lookup[0], relatives);
}
