import type { DatabaseFile, DatabaseProject } from 'common/database/types.ts';
import type { ProjectAction, ProjectInfo } from 'common/project/types.ts';

export type RPC = {
  db: {
    files: (projectId: string) => Promise<DatabaseFile[]>;
    projects: () => Promise<DatabaseProject[]>;
  };

  projects: {
    create: (projectId: string) => Promise<ProjectInfo>;
    get: () => Promise<ProjectInfo[]>;
  };

  project: {
    edit: (projectId: string, action: ProjectAction) => Promise<void>;
  };
};

export type AnyFn = (...args: any[]) => any;

export type RPCMethod<R, K extends keyof R, M extends keyof R[K]> = R[K][M] extends AnyFn
  ? R[K][M]
  : never;

export type RPCContract = {
  [K in keyof RPC]: {
    [M in keyof RPC[K]]: {
      args: Parameters<RPCMethod<RPC, K, M>>;
      return: Awaited<ReturnType<RPCMethod<RPC, K, M>>>;
    };
  };
};
