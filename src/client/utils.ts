export function querySelectorAll(element: HTMLElement | undefined, selector: string) {
  if (!element) return [];
  const selection = [...element.querySelectorAll(selector)];
  return selection.filter((element) => element instanceof HTMLElement);
}
