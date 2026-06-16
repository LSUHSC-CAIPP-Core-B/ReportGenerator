import type { Server as HTTPServer } from 'node:http';
import { Types } from 'mongoose';
import { Server, type Socket } from 'socket.io';
import { RPC_EVENT, type RPCSentRequest } from '../shared/rpc/transport.ts';
import type { RPC } from '../shared/rpc/types.ts';
import { server as $appServer } from './app.ts';
import { ProjectModel } from './database/schemas.ts';
import projects from './projects/index.ts';

export class RPCConnection {
  private connectCallbacks = new Set<(socket: Socket) => void>();
  private disconnectCallbacks = new Set<(socket: Socket, reason: string) => void>();
  private readonly io: Server;

  constructor(server: HTTPServer) {
    this.io = new Server(server);

    this.io.on('connection', (socket) => {
      console.log(`New connection: ${socket.id}`);
      this.connectCallbacks.forEach((callback) => {
        callback(socket);
      });

      socket.on('disconnect', (reason) => {
        this.disconnectCallbacks.forEach((callback) => {
          callback(socket, reason);
        });
      });
    });
  }

  onConnect(callback: (socket: Socket) => void) {
    this.connectCallbacks.add(callback);
    return () => this.connectCallbacks.delete(callback);
  }

  onDisconnect(callback: (socket: Socket, reason: string) => void) {
    this.disconnectCallbacks.add(callback);
    return () => this.disconnectCallbacks.delete(callback);
  }
}

const HANDLERS: RPC = {
  db: {
    async files(projectIdStr) {
      if (!projectIdStr?.match(/^[a-f\d]{24}$/gi)) throw Error('Invalid project id');

      const projectId = Types.ObjectId.createFromHexString(projectIdStr);

      return await ProjectModel.aggregate([
        { $match: { _id: projectId } },
        { $unwind: '$files' },
        {
          $lookup: {
            as: 'file',
            foreignField: '_id',
            from: 'files',
            localField: 'files',
          },
        },
        { $unwind: '$file' },
        {
          $replaceRoot: {
            newRoot: {
              id: '$file._id',
              path: '$file.path',
              type: '$file.type',
            },
          },
        },
      ]);
    },
    async projects() {
      return await ProjectModel.aggregate([
        {
          $replaceRoot: {
            newRoot: {
              id: '$_id',
              path: '$path',
            },
          },
        },
      ]);
    },
  },
  project: {
    async edit(projectId, action) {
      await projects.applyAction(projectId, action);

      //     socket.to(projectId).emit('local.project.updated', {
      //       action,
      //       updated,
      //     });
      //   } catch (err) {
      //     console.log(err);

      //     socket.emit('local.project.error', {
      //       action,
      //       error: String(err),
      //     });
      //   }
    },
  },
  projects: {
    async create(projectIdStr: string) {
      if (!projectIdStr?.match(/^[a-f\d]{24}$/gi)) throw Error('Invalid project id');
      const projectId = Types.ObjectId.createFromHexString(projectIdStr);

      const $project = (
        await ProjectModel.aggregate([
          { $match: { _id: projectId } },
          { $replaceRoot: { newRoot: { path: '$path' } } },
        ])
      )[0];

      const title: string = $project?.path ?? projectIdStr;
      return await projects.createProject({ project: projectIdStr, title });
    },
    async get() {
      return await projects.getAllProjects();
    },
  },
} as const;

export class RPCServer {
  readonly connection: RPCConnection;

  constructor(
    server: HTTPServer = $appServer,
    private readonly handlers: RPC = HANDLERS,
  ) {
    this.connection = new RPCConnection(server);
    this.connection.onConnect((socket) => this.registerHandlers(socket));
  }

  private registerHandlers(socket: Socket) {
    socket.on(RPC_EVENT, async (request: RPCSentRequest) => {
      const handler = (this.handlers as any)[request.scope]?.[request.method];

      if (!handler) {
        socket.emit(RPC_EVENT, {
          error: 'Method not found',
          id: request.id,
          ok: false,
        });

        return;
      }

      try {
        const result = await handler(...request.args);

        socket.emit(RPC_EVENT, {
          id: request.id,
          ok: true,
          result,
        });
      } catch (err) {
        socket.emit(RPC_EVENT, {
          error: String(err),
          id: request.id,
          ok: false,
        });
      }
    });
  }
}
