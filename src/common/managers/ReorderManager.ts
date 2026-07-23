export interface ReorderManager<T> {
  getCollection(): T[];

  get(index: number): T | undefined;
  getAll(): T[];
  put(element: T, index?: number): void;

  size(): number;
}

export const ReorderManagerDefaults = <A>() =>
  ({
    get(this: ReorderManager<A>, index: number): A | undefined {
      return this.getCollection().at(index);
    },

    getAll(this: ReorderManager<A>): A[] {
      return this.getCollection().concat();
    },

    put(this: ReorderManager<A>, element: A, index?: number) {
      const collection = this.getCollection();
      const length = collection.length;
      const includes = collection.includes(element);

      // Use length if index is not provided,
      // also keep within length of collection
      let target = (((index ?? length) % length) + length) % length;
      // We will get NaN if length is 0
      if (length === 0) target = 0;

      if (includes) {
        const selfIndex = collection.indexOf(element);

        if (selfIndex === target) return;
        else if (selfIndex < target) target--;
        collection.splice(selfIndex, 1);
      }

      if (target === collection.length) collection.push(element);
      else collection.splice(target, 0, element);
    },

    size(this: ReorderManager<A>): number {
      return this.getCollection().length;
    },
  }) satisfies Omit<ReorderManager<A>, 'getCollection'>;
