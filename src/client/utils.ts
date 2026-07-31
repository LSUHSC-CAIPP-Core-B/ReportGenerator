import { default as expand } from 'emmet';

export function querySelectorAll(element: HTMLElement | undefined, selector: string) {
  if (!element) return [];
  const selection = [...element.querySelectorAll(selector)];
  return selection.filter((element) => element instanceof HTMLElement);
}

export function e$(abbr: string): Node {
  const t = document.createElement('template');
  t.innerHTML = expand(abbr, { options: { 'output.indent': '', 'output.newline': '' } }).trim();

  if (t.content.childElementCount) {
    return t.content.firstElementChild as Node;
  } else return t.content;
}
