import { LayoutManager } from 'client/report/managers/LayoutManager.ts';
import type {
  ProjectAction,
  ProjectActions$Server,
  ProjectActionType,
  ProjectReport,
} from 'common/project/types.ts';

type ReportBuilderEvents = {
  [Type in ProjectActions$Server['type']]: {
    event: CustomEvent<Extract<ProjectActions$Server, { type: Type }>['data']>;
    data: Extract<ProjectActions$Server, { type: Type }>['data'];
  };
};

export class ReportBuilder extends EventTarget {
  private layout: LayoutManager;

  title: string;
  project: string | undefined;
  path: string | undefined;

  constructor(
    { title, groups, project, path }: ProjectReport,
    parent: HTMLElement = document.body,
  ) {
    super();

    this.title = title;
    this.project = project;
    this.path = path;

    this.layout = new LayoutManager(this, parent);

    groups?.forEach((group) => {
      this.customEvent('group:create', group);

      group.elements.forEach((options) => {
        this.customEvent('element:create', { groupId: group.identifier, options });
      });
    });
  }

  public getProjectPath() {
    return this.path!;
  }

  public override addEventListener<K extends keyof ReportBuilderEvents>(
    type: K,
    listener: (event: ReportBuilderEvents[K]['event']) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener as EventListener, options);
  }

  public override dispatchEvent(event: Event): boolean {
    return super.dispatchEvent(event);
  }

  private customEvent<K extends keyof ReportBuilderEvents>(
    type: K,
    detail: ReportBuilderEvents[K]['data'],
  ) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
