
type ErrorConstructors = (new (message?: string) => Error)
    | (new (message: string, ...args: any) => Error);

export async function catchErrorTyped<T, E extends ErrorConstructors>(
    promise: Promise<T>,
    errorsToCatch?: E[]
): Promise<[ undefined, T ] | [ InstanceType<E> ]> {
    return await promise.then(data => [ undefined, data ] as [ undefined, T ])
        .catch(error => {
            if (errorsToCatch?.some(e => error instanceof e)) return [ error ];
            if (errorsToCatch == undefined) return [ error ];
            throw error;
        });
}

export function getParam<T>(value: T | T[], index = 0): T {
    return Array.isArray(value) ? value[index] : value;
}

