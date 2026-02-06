import { Drop } from "liquidjs";
import { jsonDatabase } from "../../projects";
import { ProjectReport } from "../../projects/types";


export class ProjectsDrop extends Drop {

    async getAll() {
        return await jsonDatabase.filter<ProjectReport>('/', (entry) => true);
    }

}

