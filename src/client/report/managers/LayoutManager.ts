import type { ReportGroup } from '../models/ReportGroup.ts';
import type { ReportBuilder } from '../ReportBuilder.ts';

export class LayoutManager {
  private parent: HTMLElement;
  private menu: HTMLElement;
  private content: HTMLElement;

  private report: ReportBuilder;

  private shouldScroll: boolean = false;
  private mouseY: number = 0;

  constructor(report: ReportBuilder, parent: HTMLElement) {
    this.report = report;
    this.parent = parent;

    const menuWrapper = document.createElement('div');
    menuWrapper.classList.add('b-menu' /*, 'js-sticky' */);
    this.parent.appendChild(menuWrapper);

    const title = document.createElement('div');
    title.classList.add('menu-title');
    title.innerText = 'Table of Contents';

    menuWrapper.appendChild(title);

    this.menu = document.createElement('div');
    this.menu.classList.add('menu-container');
    menuWrapper.appendChild(this.menu);

    this.content = document.createElement('div');
    this.content.classList.add('b-content');
    this.parent.appendChild(this.content);

    this.attachGlobalEvents();
  }

  create({ title, identifier, depth }: { title: string; identifier: string; depth: number }): {
    content: HTMLDivElement;
    entry: HTMLDivElement;
  } {
    const entry = this.#createMenuEntry(title, identifier, depth);
    const content = this.createGroupContainer(identifier);

    this.menu.appendChild(entry);
    this.content.appendChild(content);

    return { content, entry };
  }

  getMenuEntry(identifier: string) {
    return this.menu.querySelector(`.menu-entry[aria-identifier="${identifier}"]`);
  }

  organize(entryIds: string[]) {
    const menuChildren = entryIds
      .map((identifier) => this.menu.querySelector(`.menu-entry[aria-identifier="${identifier}"]`))
      .filter((val, index, arr) => val && arr.indexOf(val) === index)
      .filter((val) => val != null);

    const contentChildren = entryIds
      .map((identifier) =>
        this.content.querySelector(`.b-container[aria-identifier="${identifier}"]`),
      )
      .filter((val, index, arr) => val && arr.indexOf(val) === index)
      .filter((val) => val != null);

    this.menu.replaceChildren(...menuChildren);
    this.content.replaceChildren(...contentChildren);
  }

  private attachGlobalEvents() {
    this.#handleMenuClick = this.#handleMenuClick.bind(this);
    this.#handleScroll = this.#handleScroll.bind(this);
    this.#handleMouseMove = this.#handleMouseMove.bind(this);

    document.addEventListener('click', this.#handleMenuClick);
    document.addEventListener('scroll', this.#handleScroll);
    document.addEventListener('mousemove', this.#handleMouseMove);
    document.addEventListener('drag', this.#handleMouseMove);
    // document.removeEventListener('load', this.#handleLoad);
  }

  #handleScroll = () => {
    const navbar = document.querySelector('.b-navbar');
    if (!navbar) return;

    navbar.classList.toggle('scrolled', globalThis.scrollY > 0);
  };

  private handleLoad() {
    const stickyElements = document.querySelectorAll('.js-sticky');
    const verticalScroll = globalThis.scrollY;

    for (const element of stickyElements) {
      if (!(element instanceof HTMLElement)) continue;

      const style = globalThis.getComputedStyle(element);

      if (style.position !== 'sticky') element.style.position = 'sticky';

      const parent = element.parentElement;
      if (!parent) continue;

      const parentStyle = globalThis.getComputedStyle(parent);
      const parentBorder = parent.getBoundingClientRect();
      const topPadding = parseInt(parentStyle.paddingTop, 10) || 0;
      const parentStartY = parentBorder.y + verticalScroll + topPadding;
      element.style.top = `${parentStartY}px`;
    }
  }

  collapseGroup(groupId: string) {
    const groupManager = this.report.getGroupManager();
    const group = groupManager.getGroup(groupId);

    if (!group) return;

    group.collapsed = !group.collapsed;
    group.menuEntry.classList.toggle('collapsed', group.collapsed);

    const setHidden = (child: ReportGroup, hidden: boolean) => {
      child.menuEntry.classList.toggle('hidden', hidden);
      child.content.classList.toggle('hidden', hidden);
    };

    for (const child of groupManager.getDescendants(groupId)) {
      const hidden =
        group.collapsed ||
        (() => {
          let current = child;

          while (current.parentId) {
            current = groupManager.getGroup(current.parentId) ?? child;

            if (!current || current === child) return false;
            if (current.collapsed) return true;
          }

          return false;
        })();

      setHidden(child, hidden);
    }
  }

  #handleMenuClick = (event: PointerEvent) => {
    const { target } = event;
    if (!(target instanceof HTMLElement)) return;
    const element = target.closest('.menu-entry');

    if (!element) return;
    if (!element.classList.contains('collapsable')) return;

    const groupId = element.getAttribute('aria-identifier');
    if (!groupId) return;

    this.collapseGroup(groupId);
  };

  #createMenuEntry(title: string, identifier: string, depth = 0) {
    const entry = document.createElement('div');

    entry.classList.add('menu-entry');
    if (depth > 0) {
      entry.classList.add('indent');
      entry.style.setProperty('--menu-indent', depth.toString());
    }

    entry.setAttribute('aria-identifier', identifier);
    entry.draggable = true;

    const text = document.createElement('p');
    text.classList.add('desc');
    text.innerText = title;

    entry.appendChild(text);
    return entry;
  }

  private createGroupContainer(identifier: string) {
    const group = document.createElement('div');
    group.classList.add('b-container');
    group.setAttribute('aria-identifier', identifier);

    return group;
  }

  #handleMouseMove = ({ clientY }: MouseEvent) => {
    this.mouseY = clientY;
  };

  toggleScrolling(force: boolean = !this.autoScroll) {
    const lastState = this.shouldScroll;
    this.shouldScroll = force;
    if (this.shouldScroll && !lastState) this.autoScroll();
  }

  private autoScroll() {
    if (!this.shouldScroll) return;
    let scrollDir = 0;
    const topThreshold = 80 + /* navbar */ 88;
    const bottomThreshold = 80;

    const { top, bottom } = this.parent.getBoundingClientRect();

    if (this.mouseY < top + topThreshold) scrollDir = -1;
    else if (this.mouseY > bottom - bottomThreshold) scrollDir = 1;
    else scrollDir = 0;

    this.parent.scrollTop += scrollDir * 12;
    requestAnimationFrame(() => this.autoScroll());
  }

  destroy() {
    document.removeEventListener('click', this.#handleMenuClick);
    document.removeEventListener('scroll', this.#handleScroll);
    document.removeEventListener('mousemove', this.#handleMouseMove);
    document.removeEventListener('drag', this.#handleMouseMove);
    document.removeEventListener('load', this.handleLoad);
  }
}
