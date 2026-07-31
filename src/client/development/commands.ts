import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.4.1/dist/fuse.mjs';
import type {
  CommandAction,
  CommandActionOptions,
  CommandActionStack,
} from 'common/commands/types.ts';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function between(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export class CommandPalette {
  stack: CommandActionStack[];
  actions: CommandAction[];
  currentActions: CommandAction[];

  lastKeyChar: boolean;
  originalInput: string;
  shouldAutocomplete: boolean;

  input: HTMLInputElement;
  overlay: HTMLElement;
  entries: HTMLElement;
  charReturn: HTMLElement;

  display_amount: number;

  macos: boolean;
  isOpen: boolean = false;
  forceNoClose: boolean;

  constructor({
    input,
    overlay,
    display_amount = 8,
    macos = false,
  }: { input: HTMLInputElement; overlay: HTMLElement; display_amount?: number; macos?: boolean }) {
    // For tabs
    this.stack = [];
    this.currentActions = [];

    // For auto complete
    this.lastKeyChar = false;
    this.originalInput = '';
    this.shouldAutocomplete = false;

    // For clicking
    this.forceNoClose = false;

    this.actions = [];
    this.input = input;
    this.overlay = overlay;
    this.macos = macos ?? false;
    this.display_amount = Math.max(display_amount, 5);

    const cmdEntries = overlay.querySelector('.cmd-entries');
    if (cmdEntries == null) throw Error('Overlay needs a child element with class `cmd-entries`');
    this.entries = cmdEntries as HTMLElement;

    this.keydownListener = this.keydownListener.bind(this);
    this.overlayMouseMoveListener = this.overlayMouseMoveListener.bind(this);
    this.overlayClickListener = this.overlayClickListener.bind(this);
    this.documentInputChangeListener = this.documentInputChangeListener.bind(this);
    this.documentFocusChangeListener = this.documentFocusChangeListener.bind(this);
    this.documentKeydownListener = this.documentKeydownListener.bind(this);

    document.addEventListener('keydown', this.keydownListener);
    this.overlay.addEventListener('mousemove', this.overlayMouseMoveListener);
    this.overlay.addEventListener('mousedown', this.overlayClickListener);
    this.input.addEventListener('input', this.documentInputChangeListener);
    this.input.addEventListener('focus', this.documentFocusChangeListener);
    this.input.addEventListener('focusout', this.documentFocusChangeListener);
    this.input.addEventListener('keydown', this.documentKeydownListener);

    this.charReturn = document.createElement('i');
    this.charReturn.classList.add('icon-corner-down-left', 'selection');
  }

  private pushTab(actions: CommandAction[], placeholder = '', parentAction?: CommandAction) {
    this.stack.push({
      actions: this.currentActions,
      parentAction,
      value: this.shouldAutocomplete ? this.originalInput : this.input.value,
    });

    // Let's reset auto complete
    this.shouldAutocomplete = false;
    this.originalInput = '';

    this.currentActions = actions;
    this.currentActions.forEach((action) => {
      action.parent = parentAction;
    });

    this.input.value = placeholder;
    this.renderCurrentActions();
  }

  private popTab() {
    const previous = this.stack.pop();
    if (!previous) return;

    this.currentActions = previous.actions;
    this.input.value = previous.value;

    this.renderCurrentActions();
  }

  private getRecentCommands() {
    return [...this.entries.querySelectorAll('.cmd-entry:not([hidden])')]
      .map((el) => this.currentActions.find((a) => a.element === el))
      .filter((a) => a != null);
  }

  private autocomplete() {
    // Must have been a delete key or something
    if (!this.lastKeyChar) return;

    this.originalInput = this.input.value;
    const length = this.originalInput.length;
    const query = this.originalInput.trimStart().toLowerCase();
    if (!query) return;

    const cmds = this.getRecentCommands();
    const selected = cmds.find(({ label }) => {
      const lower = label.toLowerCase();
      const index = lower.indexOf(query);
      if (index === 0) return true;

      // needs to be start of word
      return lower.substring(index - 1, index).match(/^\s$/);
    });
    if (!selected) return;

    selected.element.appendChild(this.charReturn);
    const textIndex = selected.label.toLowerCase().indexOf(query);
    const text = selected.label.substring(textIndex + query.length);

    this.shouldAutocomplete = text.length !== 0;
    if (!this.shouldAutocomplete) return;

    this.input.value += text;
    this.input.setSelectionRange(length, length + text.length);
  }

  private renderCurrentActions() {
    this.entries.innerHTML = '';

    this.currentActions.forEach((action) => {
      this.entries.appendChild(action.element);
      action.element.hidden = false;
    });

    this.executeSearch();
    this.validateSelector();
    this.updateDisplay();
  }

  /**
   * @param {Object} options
   * @param {string} options.label
   * @param {string} options.icon
   * @param {string} [options.description]
   * @param {boolean} [options.closes]
   * @param {Function} [options.callback]
   * @param {Object[]} [options.tab]
   * @param {string} [options.value]
   * @param {"start" | "end"} [options.truncate]
   *
   * @param {boolean} fromTab
   */
  addAction<B extends boolean, R extends B extends true ? CommandAction : HTMLElement>(
    {
      label,
      icon = 'dot',
      description,
      closes = true,
      callback,
      tab: tabActions = [],
      value,
      visibility = 'shown',
      truncate = 'end',
    }: CommandActionOptions,
    fromTab: B = false as B,
  ): R {
    const element = document.createElement('span');
    element.classList.add('cmd-entry');

    const iconEl = document.createElement('i');
    iconEl.classList.add('icon', `icon-${icon}`);

    const labelEl = document.createElement('p');
    labelEl.classList.add('label');
    labelEl.innerText = label;

    const descriptionEl = document.createElement('p');
    descriptionEl.setAttribute('truncate', truncate);
    descriptionEl.classList.add('description');
    descriptionEl.innerText = description ?? '';

    element.append(iconEl, labelEl, descriptionEl);

    const tab = tabActions.map((action) => this.addTabAction(action));

    const action: CommandAction = {
      callback,
      closes,
      description,
      element,
      label,
      tab,
      value,
      visibility,
    };

    if (!fromTab) {
      this.entries.appendChild(element);
      this.actions.push(action);
      if (this.stack.length === 0) this.currentActions.push(action);
    }

    return (fromTab ? action : element) as R;
  }

  private addTabAction(options: CommandActionOptions) {
    const action = this.addAction(options, true);
    action.element.toggleAttribute('cmd-tab-element', true);
    return action;
  }

  keydownListener(event: KeyboardEvent) {
    const isCommandK =
      (this.macos ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k';

    if (!isCommandK) return;

    event.preventDefault();

    if (this.isOpen) this.input.blur();
    else
      requestAnimationFrame(() => {
        this.input.focus();
      });
  }

  private select(element: HTMLElement | null) {
    const children = this.getVisibleCommands();
    if (children.length === 0) return;
    if (element == null || !children.includes(element)) return;

    let action = this.currentActions.find((action) => action.element === element);
    if (!action) return;

    if (action.tab && action.tab.length > 0) {
      this.pushTab(action.tab, '', action);
      return false;
    }

    while (action.parent != null) {
      const result = action.callback ? action.callback(action.value) : undefined;
      const value = result ?? action.value;

      if (value != null && value !== undefined) action.parent.value = value;

      action = action.parent;
      this.popTab();
    }

    // Move to most recent
    const first = this.entries.firstChild;
    this.entries.insertBefore(action.element, first);

    if (action.callback) action.callback(action.value);
    return action.closes;
  }

  /**
   * @returns {HTMLElement[]}
   */
  private getVisibleCommands(): HTMLElement[] {
    return [...this.entries.querySelectorAll('.cmd-entry:not([hidden])')].filter((el) =>
      this.currentActions.some((a) => a.element === el),
    ) as HTMLElement[];
  }

  /**
   * @param {Object} options
   * @param {boolean} options.previous
   * @param {HTMLElement} options.selected
   */
  private cycle({ previous = false, selected }: { previous: boolean; selected: HTMLElement }) {
    const children = this.getVisibleCommands();
    if (children.length === 0) return;
    const index = children.indexOf(selected);

    const size = children.length;
    // cycle forwards or back by one
    let target = index + (previous ? -1 : 1);
    // wrap between 0 and length
    target = ((target % size) + size) % size;

    const child = children[target];
    child.appendChild(this.charReturn);
    this.updateDisplay();
  }

  private validateSelector() {
    const parent = this.charReturn.parentElement;
    const children = this.getVisibleCommands();
    if (parent === null || children.indexOf(parent) === -1)
      if (children.length > 0) children[0].appendChild(this.charReturn);
  }

  private updateDisplay() {
    const parent = this.charReturn.parentElement;
    const children = this.getVisibleCommands();
    const index = Math.max(parent ? children.indexOf(parent) : -1, 0);

    const half = Math.floor(this.display_amount / 2);

    let min = clamp(index - half, 0, children.length);
    const max = clamp(min + this.display_amount, 0, children.length);
    min = clamp(min - (this.display_amount - (max - min)), 0, children.length);

    children.forEach((child, i) => {
      child.style.display = between(i, min, max - 1) ? '' : 'none';
    });
  }

  overlayMouseMoveListener(event: MouseEvent) {
    const { clientX, clientY } = event;
    const children = this.getVisibleCommands();

    const child = children.find((child) => {
      const { left, right, top, bottom } = child.getBoundingClientRect();
      return between(clientX, left, right) && between(clientY, top, bottom);
    });

    if (child != null) child.appendChild(this.charReturn);
  }

  overlayClickListener(_event: MouseEvent) {
    const selected = this.charReturn.parentElement;
    this.forceNoClose = !this.select(selected);
  }

  documentInputChangeListener(_event: InputEvent) {
    const fuse = new Fuse(this.currentActions, {
      // Ignore accents
      ignoreDiacritics: true,

      ignoreLocation: true,
      keys: ['label', 'description'],
      threshold: 0.1,
    });

    /** @type {string} */
    const query: string = this.input.value.trim();

    const matches = new Set(
      !query ? this.currentActions : fuse.search(query).map((result: any) => result.item),
    );

    this.currentActions.forEach((action) => {
      const { visibility } = action;
      const contains = matches.has(action);

      const canShow = visibility !== 'hidden' && !(visibility === 'searchable' && !query);
      const shown = (canShow && contains) || visibility === 'always';

      action.element.toggleAttribute('hidden', !shown);
    });

    this.validateSelector();
    this.updateDisplay();
    this.autocomplete();
  }

  documentKeydownListener(event: KeyboardEvent) {
    const cancelEvent = () => event.preventDefault();
    const { key } = event;

    const closes = ['Enter', 'Escape'].includes(key);
    const cycles = ['Tab', 'ArrowUp', 'ArrowDown'].includes(key);
    const selected = this.charReturn.parentElement;
    if (!selected) return;

    if (key === 'Backspace') {
      if (this.shouldAutocomplete) {
        this.shouldAutocomplete = false;
      } else if (!this.input.value) {
        cancelEvent();
        this.popTab();
        return;
      }
    }

    if (key === 'Tab' && this.shouldAutocomplete) {
      this.shouldAutocomplete = false;
      const last = this.input.value.length;
      this.input.setSelectionRange(last, last);
      cancelEvent();
      return;
    }

    if (closes) {
      if (key === 'Enter') {
        const shouldClose = this.select(selected);
        if (!shouldClose) return;
      }

      this.input.blur();
      this.input.value = '';
      return;
    }

    if (cycles) {
      cancelEvent();
      const previous = key === 'ArrowUp' || (key === 'Tab' && event.shiftKey);
      this.cycle({ previous, selected });
      return;
    }

    this.lastKeyChar = key.length === 1;
  }

  async documentFocusChangeListener(event: FocusEvent) {
    if (event.type === 'focus') return this.open();
    await new Promise((accept) => setTimeout(accept, 10));

    if (this.forceNoClose) {
      this.forceNoClose = false;
      this.input.focus();
    } else this.close();
  }

  open() {
    this.isOpen = true;
    this.overlay.style.display = '';
    this.entries.firstChild?.appendChild(this.charReturn);

    this.executeSearch();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';

    while (this.stack.length > 0) this.popTab();
  }

  private executeSearch() {
    this.input.dispatchEvent(new InputEvent('input'));
  }

  destroy() {
    document.removeEventListener('keydown', this.keydownListener);
    this.overlay.removeEventListener('click', this.overlayClickListener);
    this.input.removeEventListener('keydown', this.documentKeydownListener);
    this.overlay.remove();
  }
}
