export class ReportElement {
  identifier: string;
  type: string;
  node: HTMLElement;
  data: Record<string, any>;

  constructor({
    identifier,
    type,
    node,
    data = {},
  }: { identifier: string; type: string; node: HTMLElement; data: Record<string, any> }) {
    this.identifier = identifier;
    this.type = type;
    this.node = node;
    this.data = data;
  }
}
