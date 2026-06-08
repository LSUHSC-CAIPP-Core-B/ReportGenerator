import { model, Schema } from 'mongoose';
import type { FileEntry, HashedEntry } from './types';

const required = true,
  unique = true;

const ProjectSchema = new Schema<HashedEntry>({
  absolutePath: { required, type: String, unique },
  files: [{ refPath: 'files', type: Schema.Types.ObjectId }],
  hash: { required, type: String },
  path: { required, type: String, unique },
});

const FileSchema = new Schema<FileEntry>({
  changedOn: [{ required, type: Date }],
  createdOn: { required, type: Date },
  hash: { required, type: String },
  path: { required, type: String },
  type: { required, type: String },
});

export const ProjectModel = model<HashedEntry>('projects', ProjectSchema);
export const FileModel = model<FileEntry>('files', FileSchema);
