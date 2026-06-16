import type { Socket } from 'socket.io-client';
import type { OnlyType, RPCProxy, RPCRequestArgs } from '../../shared/rpc/transport.ts';
import { RPC_EVENT, type RPCRequest, type RPCResponse } from '../../shared/rpc/transport.ts';
import type { RPC } from '../../shared/rpc/types.ts';

export class RPCConnection {
  private connectCallbacks = new Set<() => void>();
  private disconnectCallbacks = new Set<(reason: string) => void>();

  constructor(readonly socket: Socket) {
    socket.on('connect', () => {
      this.connectCallbacks.forEach((callback) => {
        callback();
      });
    });

    socket.on('disconnect', (reason) => {
      this.disconnectCallbacks.forEach((callback) => {
        callback(reason);
      });
    });
  }

  onConnect(callback: () => void) {
    this.connectCallbacks.add(callback);
    return () => this.connectCallbacks.delete(callback);
  }

  onDisconnect(callback: (reason: string) => void) {
    this.disconnectCallbacks.add(callback);
    return () => this.disconnectCallbacks.delete(callback);
  }

  reconnect() {
    if (this.socket.connected) {
      this.socket.disconnect();
    }
    this.socket.connect();
  }
}

function createId() {
  return crypto.randomUUID();
}

export class RPCClient {
  readonly connection: RPCConnection;
  readonly rpc: RPCProxy;

  constructor(socket: Socket) {
    this.connection = new RPCConnection(socket);
    this.rpc = this.createProxy();
  }

  private createProxy(): RPCProxy {
    return new Proxy({} as RPCProxy, {
      get: <Scope extends OnlyType<keyof RPCProxy>>(_, scope: Scope) =>
        new Proxy(
          {},
          {
            get: <Method extends OnlyType<keyof RPCProxy[Scope]>>(_, method: Method) => {
              return (...args: RPCRequestArgs<Scope, Method>) => this.call(scope, method, ...args);
            },
          },
        ),
    });
  }

  private call<
    Scope extends OnlyType<keyof RPC>,
    Method extends OnlyType<keyof RPC[Scope]>,
    Args extends RPCRequestArgs<Scope, Method>,
  >(scope: Scope, method: Method, ...args: Args): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = createId();

      const request: RPCRequest<Scope, Method> = {
        args,
        id,
        method,
        scope,
      };

      const handler = (response: RPCResponse) => {
        if (response.id !== id) return;

        this.connection.socket.off(RPC_EVENT, handler);

        if (response.ok) resolve(response.result);
        else reject(new Error(response.error));
      };

      this.connection.socket.on(RPC_EVENT, handler);
      this.connection.socket.emit(RPC_EVENT, request);
    });
  }
}
