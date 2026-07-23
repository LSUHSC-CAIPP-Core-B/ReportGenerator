type ErrorConstructors =
  | (new (
      message?: string,
      ...args: any
    ) => Error)
  | (new (
      message: string,
      ...args: any
    ) => Error);

export async function catchErrorTyped<T, E extends ErrorConstructors>(
  promise: Promise<T>,
  errorsToCatch?: E[],
): Promise<[undefined, T] | [InstanceType<E>]> {
  return await promise
    .then((data) => [undefined, data] as [undefined, T])
    .catch((error) => {
      if (errorsToCatch?.some((e) => error instanceof e)) return [error];
      if (errorsToCatch === undefined) return [error];
      throw error;
    });
}

export function getParam<T>(value: T | T[], index = 0): T {
  return Array.isArray(value) ? value[index] : value;
}

export function isObjectId(id: string) {
  return /^[a-f\d]{24}$/i.test(id);
}

export function createIdentifier(length = 12) {
  const digits = '0123456789';
  const letters = 'abcdefghijklmnopqrstuvwxyz';

  return new Array(length)
    .fill(0)
    .map(() => (Math.random() > 0.6 ? digits : letters))
    .map((v) => (Math.random() > 0.5 ? v.toUpperCase() : v.toLowerCase()))
    .map((v) => v[Math.floor(Math.random() * v.length)])
    .join('');
}

type DataObj<T> = {
  [K in keyof T]: T[K] extends Function ? never : T[K];
};

export type DataOnly<T> = T extends (infer R)[] ? DataObj<R>[] : T;

export function stripFunctions<T extends object>(value: T): DataOnly<T>;
export function stripFunctions<T extends object>(value: T[]): DataOnly<T>[];
export function stripFunctions<T extends object | object[]>(value: T): DataOnly<T> {
  if (Array.isArray(value)) {
    return value.map(stripFunctions) as DataOnly<T>;
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([_, v]) => typeof v !== 'function')
        .map(([key, v]) => [key, stripFunctions(v)]),
    ) as DataOnly<T>;
  }

  return value;
}
