import type { Server as HTTPServer } from 'node:http';
import { RPC_EVENT, type RPCSentRequest } from 'common/rpc/transport.ts';
import type { RPC } from 'common/rpc/types.ts';
import { server as $appServer } from 'server/app.ts';
import projects from 'server/managers/projects.ts';
import { Server, type Socket } from 'socket.io';

/**
 * Client Connection
 */
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

/**
 * RPC Request Handler
 */
const HANDLERS: RPC = {
  db: {
    async files(projectIdStr) {
      return [];
    },
    async projects() {
      return [];
    },
  },
  project: {
    async edit(projectId, action) {
      (await projects.getProject(projectId))!.apply(action);
    },
  },

  projects: {
    async create(projectIdStr) {
      return await projects.createProject({ project: projectIdStr });
    },
    async get() {
      return await projects.getAllProjects();
    },
  },
};

/**
 * RPC Server
 */
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
