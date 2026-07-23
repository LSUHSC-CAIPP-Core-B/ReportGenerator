import type { RPC, RPCMethod } from './types.ts';

export const RPC_EVENT = '__rpc__';

export type OnlyType<T, R = string> = T extends R ? T : never;

export type RPCProxy = {
  [Scope in OnlyType<keyof RPC>]: {
    [Method in OnlyType<keyof RPC[Scope]>]: RPC[Scope][Method] extends Function
      ? RPC[Scope][Method]
      : never;
  };
};

export type RPCRequest<
  Scope extends OnlyType<keyof RPC>,
  Method extends OnlyType<keyof RPC[Scope]>,
> = {
  id: string;
  scope: Scope;
  method: Method;
  args: RPCRequestArgs<Scope, Method>;
};

export type RPCSentRequest = {
  [Scope in OnlyType<keyof RPC>]: {
    [Method in OnlyType<keyof RPC[Scope]>]: RPCRequest<Scope, Method>;
  }[OnlyType<keyof RPC[Scope]>];
}[OnlyType<keyof RPC>];

export type RPCRequestArgs<
  Scope extends OnlyType<keyof RPC>,
  Method extends OnlyType<keyof RPC[Scope]>,
> = Parameters<RPCMethod<RPC, Scope, Method>>;

export type RPCResponse =
  | {
      id: string;
      ok: true;
      result: any;
      error?: never;
    }
  | {
      id: string;
      ok: false;
      result?: never;
      error: string;
    };
