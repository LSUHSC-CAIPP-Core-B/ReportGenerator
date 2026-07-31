import type {
  DescriptionElement,
  FrameElement,
  ImageElement,
  ProjectElement,
  ProjectGroup,
  ProjectReport,
  TableElement,
} from 'common/project/types.ts';
import { model, Schema } from 'mongoose';
import type { FileEntry, HashedEntry } from './types.ts';

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

const ReportElementSchema = new Schema(
  {
    id: { required: true, type: String },
    identifier: String,
  },
  {
    _id: false, // optional if you're using your own id field
    discriminatorKey: 'type',
  },
);

const ReportDescriptionElementSchema = new Schema<DescriptionElement>(
  { data: { description: String } },
  { _id: false },
);

const ReportFrameElementSchema = new Schema<FrameElement>(
  { data: { file: String } },
  { _id: false },
);

const ReportImageElementSchema = new Schema<ImageElement>(
  { data: { description: String, file: String } },
  { _id: false },
);

const ReportTableElementSchema = new Schema<TableElement>(
  { data: { extras: Schema.Types.Mixed, file: String, type: String } },
  { _id: false },
);

const ReportGroupSchema = new Schema<ProjectGroup>(
  {
    elements: [
      {
        discriminators: {
          description: ReportDescriptionElementSchema,
          frame: ReportFrameElementSchema,
          image: ReportImageElementSchema,
          table: ReportTableElementSchema,
        },
        type: ReportElementSchema,
      },
    ],
    identifier: { required, type: String },
    parentId: { type: String },
    title: { required, type: String },
  },
  { _id: false },
);

const ReportSchema = new Schema<ProjectReport>({
  groups: [ReportGroupSchema],
  last_opened: { type: Date },
  path: { required, type: String },
  project: { type: String },
  title: { required, type: String },
});

export const ProjectModel = model<HashedEntry>('projects', ProjectSchema);
export const FileModel = model<FileEntry>('files', FileSchema);
export const ReportModel = model<ProjectReport>('reports', ReportSchema);
