import { JsonDB, Config, DataError } from 'node-json-db';
import { ProjectError, ProjectInfo, ProjectReport } from './types';
import { catchErrorTyped } from '../utilities';

const config = new Config("projects.db", true, true, '/');

class ProjectHandler {
    private readonly database: JsonDB;

    constructor() {
        this.database = new JsonDB(config);
    }

    async getProject(projectId: string) {
        const path = projectId?.toLowerCase();

        const [ error, report ] = await catchErrorTyped(
            this.database.getObject<ProjectReport>(`/${path}`),
            [ DataError ]
        );

        if (!error) await this.database.push(`/${path}/last_opened`, new Date(), true);

        return report;
    }

    async getAllProjects() {
        const [ _ignored, report ] = await catchErrorTyped(
            this.database.filter<ProjectReport>('/', (entry) => true),
            [ DataError ]
        );

        return report || [];
    }

    async createReport(projectId: string) {
        const path = projectId.toLowerCase();
        const exists = await this.database.exists(`/${path}`);
        if (exists) throw new ProjectError(`Project already exists: ${projectId}`);

        const report = {
            title: projectId,
            last_opened: (new Date()).toISOString()
        } satisfies ProjectReport

        this.database.push(`/${path}`, report, true);
    }

    async replaceReport(projectId: string, report: ProjectReport) {
        const path = projectId.toLowerCase();
        const exists = await this.database.exists(`/${path}`);
        if (!exists) throw new ProjectError(`Project doesn't exist: ${projectId}`);

        this.database.push(`/${path}`, report, true);
    }

    async patchReport(projectId: string, report: Partial<ProjectReport>) {
        const path = projectId?.toLowerCase();
        const exists = await this.database.exists(`/${path}`);
        if (!exists) throw new ProjectError(`Project doesn't exist: ${projectId}`);
        
        await this.database.push(`/${path}`, report, false);
        
        return (await catchErrorTyped(
            this.database.getObject<ProjectReport>(`/${path}`),
            [ DataError ]
        ))[1];
    }

    async deleteProject(projectId: string) {
        const path = projectId?.toLowerCase();
        const exists = await this.database.exists(`/${path}`);
        if (!exists) throw new ProjectError(`Project doesn't exist: ${projectId}`);
        
        await this.database.delete(`/${path}`);
        return true;
    }
}

export function reduceReport(report: ProjectReport) {
    return {
        title: report.title,
        last_opened: report.last_opened
    } satisfies ProjectInfo;
}

const handler = new ProjectHandler();
export default handler;

