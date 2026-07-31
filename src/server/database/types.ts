import type { Types } from 'mongoose';

export type MongoEntry = {
  _id?: Types.ObjectId;
};

export type HashedEntry = {
  hash: string;
  path: string;
  absolutePath: string;
  files: Types.ObjectId[];
} & MongoEntry;

export type FileEntry = {
  hash: string;
  type: string;
  path: string;
  createdOn: Date;
  changedOn: Date[];
  absolutePath?: string;
} & MongoEntry;
