
export interface ProjectReport {
    title: string;
    last_opened: string | Date;
}

export type ProjectInfo = Pick<ProjectReport, "title" | "last_opened">;

export class ProjectError extends Error {
    name: string = "ProjectError";
}
