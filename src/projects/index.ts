import { JsonDB, Config } from 'node-json-db';

const config = new Config("projects.db", true, false, '/');
export const jsonDatabase = new JsonDB(config);


