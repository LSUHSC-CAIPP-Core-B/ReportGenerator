import { ProjectModel } from './schemas.ts';

export async function getFilesFromProject(projectPath: string) {
  const safe = RegExp.escape(projectPath);
  const matcher = new RegExp(`${safe}/?`, 'i');

  return await ProjectModel.aggregate([
    { $match: { $expr: { $regexMatch: { input: '$path', regex: matcher } } } },
    { $unwind: { path: '$files' } },
    { $lookup: { as: 'file', foreignField: '_id', from: 'files', localField: 'files' } },
    { $unwind: { path: '$file' } },
    { $replaceRoot: { newRoot: '$file' } },
  ]);
}
